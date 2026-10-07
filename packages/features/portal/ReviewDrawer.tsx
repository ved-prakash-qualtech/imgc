/* eslint-disable react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, security/detect-object-injection -- pre-existing in this file: the indexed maps are declared
   here with literal keys, and the inline props are small local values. Left as-is so the
   type-scale change stays a class rename. */
"use client";

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { reviewDocumentAction } from "@imgc/actions/additionalDocuments";
import { StatusPill } from "@imgc/features/portal/StatusPill";
import { Button } from "@imgc/ui/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@imgc/ui/ui/sheet";
import { cn } from "@imgc/lib/utils/twMergeUtils";
import type { ReviewDecision } from "@imgc/data/services/portal/claims.server";
import type { RequirementRow } from "@imgc/data/services/portal/requirements.server";

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

function Fact({
  label,
  value,
}: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-ui-caption font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-ui-subhead font-medium text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

/** The three outcomes, and what each needs before it can be committed. */
const DECISIONS: Record<ReviewDecision, { needsRemarks: boolean }> = {
  APPROVED: { needsRemarks: false },
  REJECTED: { needsRemarks: true },
  REUPLOAD_REQUESTED: { needsRemarks: true },
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
  const errorText = useServerErrorMessage();
  const t = useTranslations("reviewDrawer");
  const tFallback = useTranslations("actionFallbacks");
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
          ? t("errors.rejectionReason")
          : t("errors.reuploadRemarks")
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
        toast.error(errorText(result) ?? tFallback("decisionFailed"));
        return;
      }
      toast.success(t(`decisions.${decision}.toast`, { name: row.name }));
      reset();
      onOpenChange(false);
    });
  }, [row, decision, remarks, reset, onOpenChange, errorText, t, tFallback]);

  if (!row) return null;

  const reviewable = Boolean(row.file) && row.active && !readOnly;

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[620px]"
      >
        <SheetHeader className="border-b border-neutral-100 px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-ui-title-lg">
            {row.name}
            <StatusPill status={row.status} />
            {!row.active && (
              <StatusPill
                status="INCOMPLETE"
                className="!bg-neutral-200 !text-neutral-600"
              />
            )}
          </SheetTitle>
          <SheetDescription>
            {row.caseId} · {row.customerName} · {row.lenderName}
          </SheetDescription>
        </SheetHeader>

        {/* ── Document information ─────────────────────────────── */}
        <section className="border-b border-neutral-100 px-5 py-4">
          <h3 className="mb-3 text-ui-body font-semibold uppercase tracking-wide text-neutral-500">
            {t("documentInformation")}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label={t("facts.caseId")} value={row.caseId} />
            <Fact label={t("facts.customer")} value={row.customerName} />
            <Fact label={t("facts.lender")} value={row.lenderName} />
            <Fact label={t("facts.category")} value={row.category} />
            <Fact
              label={t("facts.required")}
              value={row.required ? t("mandatory") : t("optional")}
            />
            <Fact
              label={t("facts.priority")}
              value={<StatusPill status={row.priority} />}
            />
            <Fact
              label={t("facts.uploadedBy")}
              value={row.file?.uploadedByName ?? "—"}
            />
            <Fact
              label={t("facts.uploadedOn")}
              value={when(row.file?.uploadedAt)}
            />
            <Fact
              label={t("facts.version")}
              value={row.version ? `v${row.version}` : "—"}
            />
            {row.file?.documentNumber && (
              <Fact
                label={t("facts.documentNo")}
                value={row.file.documentNumber}
              />
            )}
            {row.file?.documentDate && (
              <Fact
                label={t("facts.documentDate")}
                value={row.file.documentDate}
              />
            )}
            {row.dueDate && (
              <Fact
                label={t("facts.due")}
                value={when(row.dueDate).split(",")[0]}
              />
            )}
          </dl>

          {row.description && (
            <p className="mt-3 rounded-md border border-brand-primary/15 bg-brand-light/50 px-3 py-2 text-ui-body-lg leading-relaxed text-neutral-700">
              <span className="font-semibold">{t("instructions")}</span>
              {row.description}
            </p>
          )}
          {row.file?.uploadRemarks && (
            <p className="mt-2 text-ui-body-lg text-neutral-600">
              <span className="font-semibold">{t("lenderRemarks")}</span>
              {row.file.uploadRemarks}
            </p>
          )}
        </section>

        {/* ── Preview ──────────────────────────────────────────── */}
        <section className="border-b border-neutral-100 px-5 py-4">
          <h3 className="mb-3 text-ui-body font-semibold uppercase tracking-wide text-neutral-500">
            {t("preview")}
          </h3>
          {row.file ? (
            // The file route serves the real upload, or a sample PDF for a seeded demo record, so
            // the reviewer's own tab renders it (with the browser PDF viewer's download button).
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
                <span className="block truncate text-ui-subhead font-medium text-neutral-900">
                  {row.file.originalName}
                </span>
                <span className="text-ui-body-sm text-neutral-500">
                  {t("opensInNewTab", { size: bytes(row.file.size) })}
                </span>
              </span>
              <ExternalLinkIcon className="size-4 shrink-0 text-neutral-400" />
            </a>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-200 py-10 text-center text-ui-subhead text-neutral-500">
              {t("nothingToReview")}
            </p>
          )}
        </section>

        {/* ── Version history ──────────────────────────────────── */}
        {row.history.length > 0 && (
          <section className="border-b border-neutral-100 px-5 py-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-ui-body font-semibold uppercase tracking-wide text-neutral-500">
              <HistoryIcon className="size-3.5" /> {t("versionHistory")}
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
                      <span className="text-ui-body-lg font-semibold text-neutral-900">
                        {t("versionN", { version: f.version })}
                      </span>
                      {current ? (
                        <StatusPill status={row.status} />
                      ) : (
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-ui-tiny font-semibold uppercase tracking-wide text-neutral-600">
                          {t("superseded")}
                        </span>
                      )}
                      <span className="truncate text-ui-body-sm text-neutral-500">
                        {f.originalName}
                      </span>
                    </div>
                    <p className="mt-0.5 text-ui-body-sm text-neutral-500">
                      {f.uploadedByName} · {when(f.uploadedAt)}
                    </p>
                    {f.supersededReason && (
                      <p className="mt-1 text-ui-body-sm italic text-neutral-600">
                        {t("replacedBecause", { reason: f.supersededReason })}
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
            <h3 className="mb-2 text-ui-body font-semibold uppercase tracking-wide text-neutral-500">
              {t("lastDecision")}
            </h3>
            <p className="text-ui-subhead text-neutral-800">
              <span className="font-semibold">
                {t(`decisions.${row.review.decision}.label`)}
              </span>{" "}
              {t("lastDecisionLine", {
                name: row.review.byName,
                at: when(row.review.at),
                version: row.review.version,
              })}
            </p>
            {row.review.remarks && (
              <p className="mt-1 rounded-md bg-neutral-50 px-3 py-2 text-ui-body-lg text-neutral-700">
                {row.review.remarks}
              </p>
            )}
          </section>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <section className="mt-auto border-t border-neutral-100 bg-neutral-25 px-5 py-4">
          {!reviewable ? (
            <p className="text-ui-body-lg text-neutral-500">
              {readOnly
                ? t("readOnlyNote")
                : row.active
                  ? t("uploadFirst")
                  : t("withdrawn")}
            </p>
          ) : decision === null ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => setDecision("APPROVED")}
              >
                <CheckIcon /> {t("decisions.APPROVED.label")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDecision("REJECTED")}
              >
                <XIcon /> {t("decisions.REJECTED.label")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDecision("REUPLOAD_REQUESTED")}
              >
                <RotateCcwIcon /> {t("decisions.REUPLOAD_REQUESTED.label")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-ui-subhead font-medium text-neutral-900">
                {t(`decisions.${decision}.prompt`)}
              </p>
              <label className="block">
                <span className="mb-1 block text-ui-body-lg font-medium text-neutral-700">
                  {t("remarks")}
                  {DECISIONS[decision].needsRemarks
                    ? t("remarksMandatory")
                    : t("remarksOptional")}
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
                  placeholder={t(`decisions.${decision}.placeholder`)}
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-ui-subhead outline-none focus:ring-2",
                    error
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/20"
                  )}
                />
              </label>
              {error && (
                <p
                  role="alert"
                  className="text-ui-body font-medium text-destructive"
                >
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
                  {t(`decisions.${decision}.confirm`)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reset}
                  disabled={pending}
                >
                  {t("back")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
