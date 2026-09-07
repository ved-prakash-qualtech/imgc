"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  FileIcon,
  PlusIcon,
  RefreshCwIcon,
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
        STATUS_TONE[status]
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
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
  } | null>(null);

  const toggle = useCallback(
    (id: string) => setOpenId((cur) => (cur === id ? undefined : id)),
    []
  );

  const applicable = required.filter((d) => d.required && d.active);
  const done = applicable.filter(isIn).length;

  return (
    <>
      {/* ── Required documents ───────────────────────────────── */}
      <Panel
        title="Required documents"
        description={`${done} / ${applicable.length} required complete`}
        className={bare ? "border-neutral-200 shadow-none" : undefined}
        actions={
          done === applicable.length && applicable.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success-700">
              <CheckCircle2Icon className="size-3.5" /> All in
            </span>
          ) : null
        }
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
            />
          ))}
        </ol>
      </Panel>

      <Panel
        title="Additional documents"
        description="Anything beyond the required list. User-defined, added one at a time — no limit."
        className={bare ? "mt-6 border-neutral-200 shadow-none" : undefined}
        actions={
          !locked ? (
            <AddLenderDocumentDialog accountId={accountId} claimId={claimId} />
          ) : null
        }
      >
        {additional.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
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
              />
            ))}
          </ol>
        )}
      </Panel>

      <UploadDialog
        row={uploadTarget?.row ?? null}
        mode={uploadTarget?.mode}
        open={uploadTarget !== null}
        onOpenChange={(next) => !next && setUploadTarget(null)}
      />
    </>
  );
}

function DocAccordionItem({
  doc,
  index,
  accountId,
  claimId,
  locked,
  open,
  onToggle,
  onUpload,
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
  }) => void;
}>) {
  const router = useRouter();
  const hasFiles = doc.files.length > 0;
  const conditionalNotRequired = doc.conditional && !doc.required;
  const bodyId = `docbody-${doc.id}`;

  const action =
    !locked && doc.status !== "APPROVED"
      ? !hasFiles
        ? { mode: "upload" as const, label: "Upload", icon: <UploadIcon /> }
        : doc.multiple
          ? { mode: "add" as const, label: "Add File", icon: <PlusIcon /> }
          : { mode: "replace" as const, label: "Replace", icon: <RefreshCwIcon /> }
      : null;

  return (
    <li className={cn(conditionalNotRequired && "bg-neutral-25")}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
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
            onClick={() => onUpload({ row: doc, mode: action.mode })}
          >
            {action.icon}
            {action.label}
          </Button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div
        id={bodyId}
        className={cn("px-4 pb-2.5 pl-10", !open && "hidden")}
      >
        {doc.description && (
          <p className="truncate text-[12px] text-neutral-500">{doc.description}</p>
        )}
        {doc.conditional && doc.conditionReason && (
          <p className="mt-0.5 text-[11.5px] italic text-neutral-500">
            {doc.conditionReason}
            {conditionalNotRequired && " — not required for this claim."}
          </p>
        )}

        {hasFiles ? (
          <ul className="mt-2 space-y-2">
            {doc.files.map((f) => {
              const uploadedAt = new Date(f.uploadedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200/60 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <FileIcon className="size-4 shrink-0 text-brand-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-neutral-900">
                        {f.originalName}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {(f.size / 1024).toFixed(0)} KB · {f.uploadedByName}, {uploadedAt}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/portal/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex h-7 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-[11.5px] font-medium text-brand-dark transition-colors hover:bg-neutral-50 hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    View Document
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-neutral-400">
            <FileIcon className="size-3.5" /> Nothing uploaded yet.
          </p>
        )}

        {doc.status === "REJECTED" && doc.review?.remarks && (
          <p className="mt-1.5 rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-neutral-700">
            <span className="font-semibold">Reason: </span>
            {doc.review.remarks}
          </p>
        )}
        {doc.status === "REUPLOAD_REQUIRED" && doc.review?.remarks && (
          <p className="mt-1.5 rounded-md border border-warning/30 bg-warning/8 px-2.5 py-1.5 text-[12px] text-neutral-700">
            <span className="font-semibold">Query: </span>
            {doc.review.remarks}
          </p>
        )}


      </div>
    </li>
  );
}
