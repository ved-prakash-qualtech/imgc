"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  FileIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AddLenderDocumentDialog } from "@/components/portal/AddLenderDocumentDialog";
import { Panel } from "@/components/portal/Panel";
import { UploadDialog } from "@/components/portal/UploadDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { DocStatus } from "@/server/mock/types";

/** The claim-initiation status vocabulary, mapped from the portal's internal doc statuses. */
const STATUS_LABEL: Record<DocStatus, string> = {
  NOT_REQUESTED: "Not requested",
  PENDING_UPLOAD: "Pending",
  UNDER_REVIEW: "Uploaded",
  APPROVED: "Accepted",
  REJECTED: "Rejected",
  REUPLOAD_REQUIRED: "Query Raised",
};

const STATUS_TONE: Record<DocStatus, string> = {
  NOT_REQUESTED: "bg-neutral-50 text-neutral-400",
  PENDING_UPLOAD: "bg-neutral-100 text-neutral-600",
  UNDER_REVIEW: "bg-info/12 text-info",
  APPROVED: "bg-success/15 text-success-700",
  REJECTED: "bg-destructive/12 text-destructive",
  REUPLOAD_REQUIRED: "bg-warning/15 text-warning",
};

function StatusChip({ status }: Readonly<{ status: DocStatus }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
        // eslint-disable-next-line security/detect-object-injection
        STATUS_TONE[status]
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {/* eslint-disable-next-line security/detect-object-injection */}
      {STATUS_LABEL[status]}
    </span>
  );
}

function isIn(doc: RequirementRow): boolean {
  return doc.status === "UNDER_REVIEW" || doc.status === "APPROVED";
}

/**
 * The whole document section of a claim: the configured required list, then the lender's
 * additional documents, then the "add" control.
 *
 * Rendered as one accordion — exactly one card is expanded at a time, across both sections — so
 * a long checklist stays scannable. One card renderer for every document, single- or multi-file,
 * system or lender-added; everything it shows comes from `RequirementRow`.
 */
export function ClaimDocuments({
  accountId,
  claimId,
  documents,
  locked,
  bare = false,
}: Readonly<{
  accountId: string;
  claimId: string;
  documents: RequirementRow[];
  locked: boolean;
  /** Drop the card's own border/shadow — for when it's already nested inside another panel
   *  (Query Response's Attachments), where the default chrome reads as a card inside a card. */
  bare?: boolean;
}>) {
  const required = useMemo(
    () => documents.filter((d) => d.addedBy !== "LENDER"),
    [documents]
  );
  const additional = useMemo(
    () => documents.filter((d) => d.addedBy === "LENDER"),
    [documents]
  );

  // Every card starts collapsed — the checklist can run to a dozen rows, and opening on load
  // with one already expanded reads as broken the moment there's more than a couple.
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [uploadTarget, setUploadTarget] = useState<{
    row: RequirementRow;
    mode: "upload" | "add" | "replace";
    replaceFileId?: string;
  } | null>(null);

  const router = useRouter();
  const [, startDelete] = useTransition();

  const toggle = useCallback(
    (id: string) => setOpenId((cur) => (cur === id ? undefined : id)),
    []
  );

  const onDelete = useCallback(
    (accountId: string, documentId: string, fileId: string) => {
      startDelete(async () => {
        const { deleteDocumentFileAction } =
          await import("@/app/[locale]/(portal)/additional-documents/actions");
        const result = await deleteDocumentFileAction(
          accountId,
          documentId,
          fileId
        );
        if (!result.ok) {
          toast.error(result.error ?? "Could not delete that file.");
          return;
        }
        toast.success("File removed.");
        router.refresh();
      });
    },
    [router]
  );

  const applicable = required.filter((d) => d.required && d.active);
  const done = applicable.filter(isIn).length;

  const requiredActions =
    done === applicable.length && applicable.length > 0 ? (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success-700">
        <CheckCircle2Icon className="size-3.5" /> All in
      </span>
    ) : null;

  const additionalActions = !locked ? (
    <AddLenderDocumentDialog accountId={accountId} claimId={claimId} />
  ) : null;

  return (
    <>
      {/* ── Required documents ───────────────────────────────── */}
      <Panel
        title="Required documents"
        description={`${done} / ${applicable.length} required complete`}
        className={bare ? "border-neutral-200 shadow-none" : undefined}
        actions={requiredActions}
      >
        <ol className="divide-y divide-neutral-100">
          {required.map((doc, i) => (
            <DocAccordionItem
              key={doc.id}
              index={i + 1}
              doc={doc}
              accountId={accountId}
              claimId={claimId}
              locked={locked}
              open={openId === doc.id}
              onToggle={toggle}
              onUpload={setUploadTarget}
              onDelete={onDelete}
            />
          ))}
        </ol>
      </Panel>

      <Panel
        title="Additional documents"
        className={bare ? "mt-6 border-neutral-200 shadow-none" : undefined}
        actions={additionalActions}
      >
        {additional.length === 0 ? (
          <p className="px-5 py-4 text-center text-[13px] text-neutral-500">
            No additional documents added.
          </p>
        ) : (
          <ol className="divide-y divide-neutral-100">
            {additional.map((doc) => (
              <DocAccordionItem
                key={doc.id}
                doc={doc}
                accountId={accountId}
                claimId={claimId}
                locked={locked}
                open={openId === doc.id}
                onToggle={toggle}
                onUpload={setUploadTarget}
                onDelete={onDelete}
              />
            ))}
          </ol>
        )}
      </Panel>

      <UploadDialog
        row={uploadTarget?.row ?? null}
        mode={uploadTarget?.mode}
        replaceFileId={uploadTarget?.replaceFileId}
        open={uploadTarget !== null}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onOpenChange={(next) => !next && setUploadTarget(null)}
      />
    </>
  );
}

function DocAccordionItem({
  doc,
  index,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accountId: _accountId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  claimId: _claimId,
  locked,
  open,
  onToggle,
  onUpload,
  onDelete,
}: Readonly<{
  doc: RequirementRow;
  index?: number;
  accountId: string;
  claimId: string;
  locked: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  onUpload: (t: {
    row: RequirementRow;
    mode: "upload" | "add" | "replace";
    replaceFileId?: string;
  }) => void;
  onDelete: (accountId: string, documentId: string, fileId: string) => void;
}>) {
  const hasFiles = doc.files.length > 0;
  const conditionalNotRequired = doc.conditional && !doc.required;
  const bodyId = `docbody-${doc.id}`;

  // Pre-seeded docs are now treated the same as any other multi-upload document:
  // the lender can add more files on top of the seeded one and can delete individual files.
  // The old guard (blocking Add File for seeded docs) is intentionally removed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _imgcRejected = doc.status === "REJECTED";
  const action =
    !locked && doc.status !== "APPROVED"
      ? !hasFiles
        ? { mode: "upload" as const, label: "Upload", icon: <UploadIcon /> }
        : { mode: "add" as const, label: "Add File", icon: <PlusIcon /> }
      : null;

  return (
    <li className={cn(conditionalNotRequired && "bg-neutral-25")}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onClick={() => onToggle(doc.id)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180"
            )}
          />
          <span className="truncate text-[13.5px] font-semibold text-neutral-950">
            {index ? `${index}. ` : ""}
            {doc.name}
          </span>
          {doc.refNo && (
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-neutral-500">
              {doc.refNo}
            </span>
          )}
          {doc.required ? (
            <span className="shrink-0 rounded bg-brand-light px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand-dark">
              Required{doc.conditional ? " *" : ""}
            </span>
          ) : (
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">
              {doc.addedBy === "LENDER" ? "Additional" : "Optional"}
            </span>
          )}
          {doc.multiple && (
            <span className="hidden shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-500 sm:inline">
              Multiple
            </span>
          )}
          {hasFiles && !open && (
            <span className="hidden shrink-0 text-[11.5px] text-neutral-400 sm:inline">
              {doc.files.length} file{doc.files.length === 1 ? "" : "s"}
            </span>
          )}
        </button>

        <StatusChip status={doc.status} />

        {action && (
          <Button
            size="xs"
            variant={action.mode === "upload" ? "default" : "outline"}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => onUpload({ row: doc, mode: action.mode })}
          >
            {action.icon}
            {action.label}
          </Button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div id={bodyId} className={cn("px-4 pb-2.5 pl-10", !open && "hidden")}>
        {doc.description && (
          <p className="truncate text-[12px] text-neutral-500">
            {doc.description}
          </p>
        )}
        {doc.conditional && doc.conditionReason && (
          <p className="mt-0.5 text-[11.5px] italic text-neutral-500">
            {doc.conditionReason}
            {conditionalNotRequired && " — not required for this claim."}
          </p>
        )}

        {hasFiles ? (
          <ul className="mt-1.5 space-y-1.5">
            {doc.files.map((f) => {
              const uploadedAt = new Date(f.uploadedAt).toLocaleString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              );

              const isRejected =
                doc.status === "REJECTED" && f.version === doc.review?.version;
              const isReuploadReq =
                doc.status === "REUPLOAD_REQUIRED" &&
                f.version === doc.review?.version;
              const needsFix = isRejected || isReuploadReq;
              const borderTheme = isRejected
                ? "border-destructive/40 bg-destructive/5"
                : isReuploadReq
                  ? "border-warning/40 bg-warning/5"
                  : "border-neutral-200/60 bg-white";
              const textTheme = isRejected
                ? "text-destructive"
                : isReuploadReq
                  ? "text-warning-700"
                  : "text-brand-primary";

              return (
                <li
                  key={f.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border px-3 py-2 shadow-sm",
                    borderTheme
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <FileIcon className={cn("size-4 shrink-0", textTheme)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-neutral-900">
                          {f.originalName}
                          {isRejected && (
                            <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                              Rejected
                            </span>
                          )}
                        </p>
                        <p
                          className={cn(
                            "truncate text-[11px]",
                            needsFix
                              ? isRejected
                                ? "text-destructive/80"
                                : "text-warning-700/80"
                              : "text-neutral-500"
                          )}
                        >
                          {(f.size / 1024).toFixed(0)} KB · {f.uploadedByName},{" "}
                          {uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {needsFix && !locked && (
                        <button
                          type="button"
                          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                          onClick={() =>
                            onUpload({
                              row: doc,
                              mode: "replace",
                              replaceFileId: f.id,
                            })
                          }
                          className={cn(
                            "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border bg-white px-3 text-[11.5px] font-medium transition-colors focus:outline-none focus:ring-2",
                            isRejected
                              ? "border-destructive/30 text-destructive hover:bg-destructive/10 focus:ring-destructive/20"
                              : "border-warning/30 text-warning-700 hover:bg-warning/10 focus:ring-warning/20"
                          )}
                        >
                          <UploadIcon className="size-3.5" />
                          Re-upload
                        </button>
                      )}
                      <a
                        href={`/api/portal/files/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "shrink-0 inline-flex h-7 items-center justify-center rounded-md border px-3 text-[11.5px] font-medium transition-colors focus:outline-none focus:ring-2",
                          needsFix
                            ? isRejected
                              ? "border-destructive/30 bg-white text-destructive hover:bg-destructive/10 focus:ring-destructive/20"
                              : "border-warning/30 bg-white text-warning-700 hover:bg-warning/10 focus:ring-warning/20"
                            : "border-neutral-200 bg-white text-brand-dark hover:bg-neutral-50 hover:text-brand-primary focus:ring-brand-primary/20"
                        )}
                      >
                        View Document
                      </a>
                      {!locked && doc.status !== "APPROVED" && (
                        <button
                          type="button"
                          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                          onClick={() => onDelete(doc.accountId, doc.id, f.id)}
                          title="Delete this file"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {needsFix && doc.review?.remarks && (
                    <p
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[12px] text-neutral-700",
                        isRejected
                          ? "border-destructive/15 bg-white/60"
                          : "border-warning/15 bg-white/60"
                      )}
                    >
                      <span className="font-semibold">
                        {isRejected ? "Reason: " : "Query: "}
                      </span>
                      {doc.review.remarks}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-neutral-400">
            <FileIcon className="size-3.5" /> Nothing uploaded yet.
          </p>
        )}
      </div>
    </li>
  );
}
