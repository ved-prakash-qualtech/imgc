"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  RotateCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AddLenderDocumentDialog } from "@/components/portal/AddLenderDocumentDialog";
import { clip, FileDecisionNote } from "@/components/portal/FileDecisionNote";
import { Panel } from "@/components/portal/Panel";
import { useConfirmDelete } from "@/components/portal/useConfirmDelete";
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
  claimStatus,
  allowDelete = true,
  bare = false,
  variant = "accordion",
}: Readonly<{
  accountId: string;
  claimId: string;
  documents: RequirementRow[];
  locked: boolean;
  claimStatus?: string;
  /** Deleting an uploaded file is a draft-only act: once the claim is submitted the file is part
   *  of what IMGC is reviewing, so it can be superseded by a re-upload but never removed. */
  allowDelete?: boolean;
  /** Drop the card's own border/shadow — for when it's already nested inside another panel
   *  (Query Response's Attachments), where the default chrome reads as a card inside a card. */
  bare?: boolean;
  /** "table" renders each section as a flat table (one row per file, like the IMGC review
   *  screen) instead of the collapsible accordion — used by the Initiate Claim workspace. */
  variant?: "accordion" | "table";
}>) {
  const isDraftStage = !claimStatus || claimStatus === "DRAFT";
  const required = useMemo(
    () => documents.filter((d) =>
          d.addedBy !== "LENDER" &&
          // Once the claim is initiated, an optional document nobody uploaded is just noise.
          (isDraftStage || d.required || d.files.length > 0)),
    [documents, isDraftStage]
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

  // While a delete is running every delete button is disabled, so a double click cannot remove a
  // second file.
  const [deleting, startDelete] = useTransition();

  const toggle = useCallback(
    (id: string) => setOpenId((cur) => (cur === id ? undefined : id)),
    []
  );

  const { ask, dialog: confirmDialog } = useConfirmDelete();

  const removeFile = useCallback(
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
      });
    },
    []
  );

  // Every trash button on this screen goes through here, so the confirmation covers all of them.
  const onDelete = useCallback(
    (accountId: string, documentId: string, fileId: string, fileName?: string) => {
      ask({
        description: fileName
          ? `"${fileName}" will be permanently deleted. This cannot be undone.`
          : "This file will be permanently deleted. This cannot be undone.",
        confirmLabel: "Delete file",
        onConfirm: () => removeFile(accountId, documentId, fileId),
      });
    },
    [ask, removeFile]
  );

  const applicable = required.filter((d) => d.required && d.active);

  // The lender can add documents only while the claim is still open to them: a draft, or a query
  // they are answering. Once it is initiated and with IMGC, there is nothing to add here - so the
  // Add button goes, and an Additional documents panel with nothing in it goes too.
  const claimOpenForChanges =
    !claimStatus ||
    claimStatus === "DRAFT" ||
    claimStatus === "QUERY_INITIATED" ||
    claimStatus === "QUERY_UNDER_REVIEW";
  // The Additional documents panel is only for the stages where the lender is adding to the
  // claim: initiation (draft), a query, or while a document stands rejected. Otherwise hidden.
  const hasRejectedDoc = documents.some(
    (d) => d.status === "REJECTED" || d.status === "REUPLOAD_REQUIRED"
  );
  const showAdditional = claimOpenForChanges || hasRejectedDoc;

  const additionalActions = !locked && claimOpenForChanges ? (
    <AddLenderDocumentDialog accountId={accountId} claimId={claimId} />
  ) : null;

  return (
    <>
      {/* ── Required documents ───────────────────────────────── */}
      <Panel
        title="Required documents"
        className={bare ? "border-neutral-200 shadow-none" : undefined}
      >
        {variant === "table" ? (
          <DocumentsTable
            docs={required}
            indexed
            locked={locked}
            allowDelete={allowDelete}
            onUpload={setUploadTarget}
            onDelete={onDelete}
            deleting={deleting}
            claimStatus={claimStatus}
          />
        ) : (
          <ol className="divide-y divide-neutral-100">
            {required.map((doc, i) => (
              <DocAccordionItem
                key={doc.id}
                index={i + 1}
                doc={doc}
                accountId={accountId}
                claimId={claimId}
                locked={locked}
                allowDelete={allowDelete}
                open={openId === doc.id}
                onToggle={toggle}
                onUpload={setUploadTarget}
                onDelete={onDelete}
                deleting={deleting}
                claimStatus={claimStatus}
              />
            ))}
          </ol>
        )}
      </Panel>

      {showAdditional && (
      <Panel
        title="Additional documents"
        className={bare ? "mt-6 border-neutral-200 shadow-none" : "mt-1.5"}
        actions={additionalActions}
      >
        {additional.length === 0 ? (
          <p className="px-5 py-4 text-center text-[13px] text-neutral-500">
            No additional documents added.
          </p>
        ) : variant === "table" ? (
          <DocumentsTable
            docs={additional}
            locked={locked}
            allowDelete={allowDelete}
            onUpload={setUploadTarget}
            onDelete={onDelete}
            deleting={deleting}
            claimStatus={claimStatus}
          />
        ) : (
          <ol className="divide-y divide-neutral-100">
            {additional.map((doc) => (
              <DocAccordionItem
                key={doc.id}
                doc={doc}
                accountId={accountId}
                claimId={claimId}
                locked={locked}
                allowDelete={allowDelete}
                open={openId === doc.id}
                onToggle={toggle}
                onUpload={setUploadTarget}
                onDelete={onDelete}
                deleting={deleting}
                claimStatus={claimStatus}
              />
            ))}
          </ol>
        )}
      </Panel>
      )}

      <UploadDialog
        row={uploadTarget?.row ?? null}
        mode={uploadTarget?.mode}
        replaceFileId={uploadTarget?.replaceFileId}
        open={uploadTarget !== null}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onOpenChange={(next) => !next && setUploadTarget(null)}
      />

      {confirmDialog}
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
  allowDelete,
  open,
  onToggle,
  onUpload,
  onDelete,
  deleting,
  claimStatus,
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
  onDelete: (
    accountId: string,
    documentId: string,
    fileId: string,
    fileName?: string
  ) => void;
  allowDelete: boolean;
  /** A delete is running — every delete button stays disabled until it settles. */
  deleting: boolean;
  claimStatus?: string;
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

  const canModifyDocuments = !claimStatus ||
    claimStatus === "DRAFT" ||
    claimStatus === "QUERY_INITIATED" ||
    claimStatus === "QUERY_UNDER_REVIEW" ||
    doc.status === "REJECTED" ||
    doc.status === "REUPLOAD_REQUIRED";

  const isDisabled = claimStatus ? !canModifyDocuments : false;

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

        {/* Not offered at all while the claim is not open for changes - a greyed-out button
            only invites a click that cannot do anything. */}
        {action && !isDisabled && (
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
                        <FileDecisionNote review={f.review} />
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
                      {!locked && (allowDelete || claimStatus !== undefined) && doc.status !== "APPROVED" && !(claimStatus !== undefined && isDisabled && !allowDelete) && (
                        <button
                          type="button"
                          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                          onClick={() => onDelete(doc.accountId, doc.id, f.id, f.originalName)}
                          title="Delete this file"
                          disabled={deleting}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-neutral-200 disabled:hover:text-neutral-400"
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

function bytes(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The flat-table rendering of a document list — one row per file (or one placeholder row for a
 * document with nothing uploaded yet), matching the table the IMGC review screen already uses.
 * Used by the Initiate Claim workspace in place of the accordion.
 */
/** The columns the claim-document table can be sorted by. */
type DocSortField =
  | "name"
  | "status"
  | "fileName"
  | "size"
  | "uploadedBy"
  | "dateTime";

/** Defined outside the table so it is one component, not a new one on every render. */
function SortIcon({
  field,
  sortField,
  sortDirection,
}: Readonly<{
  field: DocSortField;
  sortField: DocSortField | null;
  sortDirection: "asc" | "desc";
}>) {
  if (sortField !== field) {
    return (
      <ArrowUpDownIcon className="ml-1 inline-block size-3 text-neutral-300" />
    );
  }
  return sortDirection === "asc" ? (
    <ChevronUpIcon className="ml-1 inline-block size-3" />
  ) : (
    <ChevronDownIcon className="ml-1 inline-block size-3" />
  );
}

function DocumentsTable({
  docs,
  indexed = false,
  locked,
  allowDelete,
  onUpload,
  onDelete,
  deleting,
  claimStatus,
}: Readonly<{
  docs: RequirementRow[];
  /** Number the rows 1., 2., 3. — only the required-documents list does this. */
  indexed?: boolean;
  locked: boolean;
  claimStatus?: string;
  onUpload: (t: {
    row: RequirementRow;
    mode: "upload" | "add" | "replace";
    replaceFileId?: string;
  }) => void;
  onDelete: (
    accountId: string,
    documentId: string,
    fileId: string,
    fileName?: string
  ) => void;
  allowDelete: boolean;
  /** A delete is running — every delete button stays disabled until it settles. */
  deleting: boolean;
}>) {
  // No sort until a header is clicked: the list arrives mandatory-first in IMGC's configured
  // order, and that is the order the lender should work down.
  const [sortField, setSortField] = useState<DocSortField | null>(null);

  // IMGC's column only earns its place once IMGC has actually decided something here: while the
  // lender is still initiating the claim it would be a column of dashes.
  const showImgcRemark = docs.some((d) => d.files.some((f) => f.review));
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedDocs = useMemo(() => {
    if (!sortField) return docs;
    return [...docs].sort((a, b) => {
      const aFile = a.files[0];
      const bFile = b.files[0];
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "fileName": cmp = (aFile?.originalName || "").localeCompare(bFile?.originalName || ""); break;
        case "size": cmp = (aFile?.size || 0) - (bFile?.size || 0); break;
        case "uploadedBy": cmp = (aFile?.uploadedByName || "").localeCompare(bFile?.uploadedByName || ""); break;
        case "dateTime": cmp = (aFile?.uploadedAt || "").localeCompare(bFile?.uploadedAt || ""); break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [docs, sortField, sortDirection]);

  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField]);

  const sortable = (field: DocSortField, label: string) => (
    <th className="px-3 py-2">
      <button
        type="button"
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => handleSort(field)}
        className="flex select-none items-center hover:text-neutral-700"
      >
        {label}
        <SortIcon
          field={field}
          sortField={sortField}
          sortDirection={sortDirection}
        />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-[11.5px]">
        <thead className="bg-neutral-50 text-[10.5px] font-medium text-neutral-500">
          <tr>
            {sortable("name", "Document Type")}
            {sortable("fileName", "File Name")}
            <th className="px-3 py-2">Lender Remark</th>
            {showImgcRemark && <th className="px-3 py-2">IMGC Remark</th>}
            {sortable("uploadedBy", "Uploaded By")}
            {sortable("dateTime", "Date/Time")}
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sortedDocs.map((doc, i) => (
            <DocTableRows
              key={doc.id}
              index={indexed ? i + 1 : undefined}
              doc={doc}
              locked={locked}
              allowDelete={allowDelete}
              onUpload={onUpload}
              onDelete={onDelete}
              deleting={deleting}
              claimStatus={claimStatus}
              showImgcRemark={showImgcRemark}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocTableRows({
  doc,
  index,
  locked,
  onUpload,
  allowDelete,
  onDelete,
  deleting,
  claimStatus,
  showImgcRemark,
}: Readonly<{
  doc: RequirementRow;
  index?: number;
  locked: boolean;
  onUpload: (t: {
    row: RequirementRow;
    mode: "upload" | "add" | "replace";
    replaceFileId?: string;
  }) => void;
  onDelete: (
    accountId: string,
    documentId: string,
    fileId: string,
    fileName?: string
  ) => void;
  allowDelete: boolean;
  /** A delete is running — every delete button stays disabled until it settles. */
  deleting: boolean;
  claimStatus?: string;
  showImgcRemark: boolean;
}>) {
  const hasFiles = doc.files.length > 0;
  const canAddMore = !locked && doc.status !== "APPROVED";
  const rowSpan = hasFiles ? doc.files.length : 1;

  const canModifyDocuments = !claimStatus ||
    claimStatus === "DRAFT" ||
    claimStatus === "QUERY_INITIATED" ||
    claimStatus === "QUERY_UNDER_REVIEW" ||
    doc.status === "REJECTED" ||
    doc.status === "REUPLOAD_REQUIRED";

  const isDisabled = claimStatus ? !canModifyDocuments : false;

  const nameCell = (
    <td rowSpan={rowSpan} className="px-3 py-2 align-top">
      <span className="font-semibold text-neutral-950">
        {index ? `${index}. ` : ""}
        {doc.name}
        {doc.required && <span className="text-destructive">*</span>}
      </span>
      <div className="mt-1.5">
        <StatusChip status={doc.status} />
      </div>
      {doc.refNo && (
        <div className="mt-1">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-neutral-500">
            {doc.refNo}
          </span>
        </div>
      )}
    </td>
  );


  const actionsCell = (extra?: ReactNode) => (
    <td className="px-3 py-2 align-top">
      <div className="flex flex-wrap gap-1.5">
        {extra}
        {canAddMore && !isDisabled && (
          <Button
            size="xs"
            variant={hasFiles ? "outline" : "default"}
            // Adding another file is an icon, like Delete beside it; the first upload keeps its
            // label, since on an empty row it is the one thing to do.
            className={hasFiles ? "size-7 p-0" : "h-7 px-2 text-[11px]"}
            title={hasFiles ? "Add file" : undefined}
            aria-label={hasFiles ? "Add file" : undefined}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() =>
              onUpload({ row: doc, mode: hasFiles ? "add" : "upload" })
            }
          >
            {hasFiles ? <PlusIcon /> : <UploadIcon />}
            {!hasFiles && "Upload"}
          </Button>
        )}
      </div>
    </td>
  );

  if (!hasFiles) {
    return (
      <tr>
        {nameCell}
        <td className="px-3 py-2 text-neutral-400" colSpan={showImgcRemark ? 5 : 4}>
          Nothing uploaded yet.
        </td>
        {actionsCell()}
      </tr>
    );
  }

  return (
    <>
      {doc.files.map((f, i) => {
        const isRejected =
          doc.status === "REJECTED" && f.version === doc.review?.version;
        const isReuploadReq =
          doc.status === "REUPLOAD_REQUIRED" &&
          f.version === doc.review?.version;
        const needsFix = isRejected || isReuploadReq;

        return (
          <tr key={f.id}>
            {i === 0 && nameCell}
            <td className="px-3 py-2 align-top">
              <a
                href={`/api/portal/files/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-medium hover:underline",
                  isRejected
                    ? "text-destructive"
                    : isReuploadReq
                      ? "text-warning-700"
                      : "text-brand-dark"
                )}
                title={f.originalName}
              >
                {clip(f.originalName, 20)}
              </a>
              {/* Size sits under the name, as on IMGC's Decision tab - no column of its own. */}
              <span className="block text-[11px] text-neutral-400">{bytes(f.size)}</span>
              {/* The requirement-level reason, only for files decided before decisions were per
                  file - a file with its own decision already shows its own remark above. */}
              {needsFix && !f.review && doc.review?.remarks && (
                <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-neutral-500">
                  {isRejected ? "Reason: " : "Query: "}
                  {doc.review.remarks}
                </p>
              )}
            </td>
            {/* What the lender wrote on upload, and what IMGC said on accepting or rejecting this
                file - the same two columns IMGC reads on its Decision tab. */}
            <td
              className="max-w-[200px] px-3 py-2 align-top text-[11px] text-neutral-600"
              title={f.uploadRemarks?.trim() || undefined}
            >
              {f.uploadRemarks?.trim() ? (
                clip(f.uploadRemarks.trim(), 34)
              ) : (
                <span className="text-neutral-300">—</span>
              )}
            </td>
            {showImgcRemark && (
              <td className="max-w-[200px] px-3 py-2 align-top">
                {f.review ? (
                  <FileDecisionNote review={f.review} className="mt-0" maxChars={34} />
                ) : (
                  <span className="text-[11px] text-neutral-300">—</span>
                )}
              </td>
            )}
            <td className="px-3 py-2 align-top text-neutral-500">
              {f.uploadedByName || "—"}
            </td>
            <td className="px-3 py-2 align-top text-neutral-500">
              {when(f.uploadedAt)}
            </td>
            {i === 0
              ? actionsCell(
                  <>
                    {needsFix && !locked && (
                      <Button
                        size="xs"
                        variant="outline"
                        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                        onClick={() =>
                          onUpload({
                            row: doc,
                            mode: "replace",
                            replaceFileId: f.id,
                          })
                        }
                        className={
                          isRejected
                            ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                            : "border-warning/30 text-warning-700 hover:bg-warning/10"
                        }
                      >
                        <UploadIcon /> Re-upload
                      </Button>
                    )}
                    {!locked && (allowDelete || claimStatus !== undefined) && doc.status !== "APPROVED" && !(claimStatus !== undefined && isDisabled && !allowDelete) && (
                      <Button
                        size="xs"
                        variant="outline"
                        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                        onClick={() => onDelete(doc.accountId, doc.id, f.id, f.originalName)}
                        title="Delete this file"
                        disabled={deleting}
                        className="size-7 p-0 text-neutral-400 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:hover:bg-transparent disabled:hover:border-neutral-200 disabled:hover:text-neutral-400 disabled:opacity-50"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    )}
                  </>
                )
              : (() => {
                  const cell = (
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {needsFix && !locked && (
                          <Button
                            size="xs"
                            variant="outline"
                            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                            onClick={() =>
                              onUpload({
                                row: doc,
                                mode: "replace",
                                replaceFileId: f.id,
                              })
                            }
                            className={
                              isRejected
                                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                                : "border-warning/30 text-warning-700 hover:bg-warning/10"
                            }
                          >
                            <UploadIcon /> Re-upload
                          </Button>
                        )}
                        {!locked && (allowDelete || claimStatus !== undefined) && doc.status !== "APPROVED" && !(claimStatus !== undefined && isDisabled && !allowDelete) && (
                          <Button
                            size="xs"
                            variant="outline"
                            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                            onClick={() =>
                              onDelete(doc.accountId, doc.id, f.id, f.originalName)
                            }
                            title="Delete this file"
                            disabled={deleting}
                            className="size-7 p-0 text-neutral-400 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:hover:bg-transparent disabled:hover:border-neutral-200 disabled:hover:text-neutral-400 disabled:opacity-50"
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  );
                  return cell;
                })()}
          </tr>
        );
      })}
    </>
  );
}
