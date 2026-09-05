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

import { saveDocumentRemarkAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
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

/** The row that most needs attention — used to decide which accordion item opens first. */
function firstToActOn(docs: RequirementRow[]): string | undefined {
  const needy = docs.find(
    (d) =>
      d.status === "PENDING_UPLOAD" ||
      d.status === "REJECTED" ||
      d.status === "REUPLOAD_REQUIRED"
  );
  return (needy ?? docs[0])?.id;
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
}: Readonly<{
  accountId: string;
  claimId: string;
  documents: RequirementRow[];
  locked: boolean;
}>) {
  const required = useMemo(
    () => documents.filter((d) => d.addedBy !== "LENDER"),
    [documents]
  );
  const additional = useMemo(
    () => documents.filter((d) => d.addedBy === "LENDER"),
    [documents]
  );

  const [openId, setOpenId] = useState<string | undefined>(() =>
    firstToActOn(required)
  );
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

      {/* ── Additional documents ─────────────────────────────── */}
      <Panel
        title="Additional documents"
        description="Anything beyond the required list. User-defined, added one at a time — no limit."
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
  const [pending, startTransition] = useTransition();
  const [remark, setRemark] = useState(doc.latestRemark);
  const [remarkDirty, setRemarkDirty] = useState(false);

  const hasFiles = doc.files.length > 0;
  const conditionalNotRequired = doc.conditional && !doc.required;
  const bodyId = `docbody-${doc.id}`;

  const onSaveRemark = useCallback(() => {
    startTransition(async () => {
      const result = await saveDocumentRemarkAction(
        accountId,
        claimId,
        doc.id,
        remark
      );
      if (!result.ok) {
        toast.error(result.error ?? "That remark could not be saved.");
        return;
      }
      setRemarkDirty(false);
      toast.success("Remarks saved.");
      router.refresh();
    });
  }, [accountId, claimId, doc.id, remark, router]);

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
      <div className="flex items-center gap-2 px-5 py-3">
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
        className={cn("px-5 pb-4 pl-11", !open && "hidden")}
      >
        {doc.description && (
          <p className="text-[12px] text-neutral-500">{doc.description}</p>
        )}
        {doc.conditional && doc.conditionReason && (
          <p className="mt-1 text-[11.5px] italic text-neutral-500">
            {doc.conditionReason}
            {conditionalNotRequired && " — not required for this claim."}
          </p>
        )}

        {hasFiles ? (
          <ul className="mt-2 space-y-1">
            {doc.files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 text-[12.5px] text-neutral-700"
              >
                <CheckCircle2Icon className="size-3.5 shrink-0 text-success-600" />
                <span className="truncate font-medium">{f.originalName}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">
                  v{f.version}
                </span>
              </li>
            ))}
            <li className="text-[11.5px] text-neutral-400">
              {doc.files.length} file{doc.files.length === 1 ? "" : "s"} uploaded
            </li>
          </ul>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-neutral-400">
            <FileIcon className="size-3.5" /> Nothing uploaded yet.
          </p>
        )}

        {doc.status === "REJECTED" && doc.review?.remarks && (
          <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-neutral-700">
            <span className="font-semibold">Reason: </span>
            {doc.review.remarks}
          </p>
        )}
        {doc.status === "REUPLOAD_REQUIRED" && doc.review?.remarks && (
          <p className="mt-2 rounded-md border border-warning/30 bg-warning/8 px-2.5 py-1.5 text-[12px] text-neutral-700">
            <span className="font-semibold">Query: </span>
            {doc.review.remarks}
          </p>
        )}

        {!locked && (
          <div className="mt-3">
            <span className="mb-1 block text-[11.5px] font-medium text-neutral-600">
              Remarks
            </span>
            <div className="flex flex-wrap items-start gap-2">
              <textarea
                aria-label={`Remarks on ${doc.name}`}
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                  setRemarkDirty(true);
                }}
                rows={2}
                placeholder="Notes against this document."
                className="min-w-[240px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
              <Button
                size="xs"
                variant="outline"
                onClick={onSaveRemark}
                disabled={pending || !remarkDirty}
              >
                Save Remarks
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
