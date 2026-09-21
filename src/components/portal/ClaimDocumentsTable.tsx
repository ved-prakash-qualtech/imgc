"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { DocStatus } from "@/server/mock/types";

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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
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

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Clamped so a huge byte count can't index past the last unit.
  const unit = sizes[Math.min(i, sizes.length - 1)];
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${unit}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortField = "name" | "status" | "fileName" | "size" | "dateTime";

/** Defined here rather than inside the table so it is one component, not a new one per render. */
function HeaderSortIcon({
  field,
  sortField,
  sortDirection,
}: Readonly<{
  field: SortField;
  sortField: SortField | null;
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

function TableLayout({
  children,
  sortField,
  sortDirection,
  onSort,
  showActions,
  showImgcRemark,
}: {
  children: React.ReactNode;
  sortField: SortField | null;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  /** Drop the Actions column entirely when nothing in the table can be acted on. */
  showActions: boolean;
  /** IMGC's column appears once IMGC has decided at least one file in this table. */
  showImgcRemark: boolean;
}) {
  const plain =
    "h-7 bg-neutral-50 px-2 text-[10px] font-medium text-neutral-500";
  const head = (field: SortField, label: string) => (
    <TableHead className={plain}>
      <button
        type="button"
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => onSort(field)}
        className="flex select-none items-center hover:text-neutral-700"
      >
        {label}
        <HeaderSortIcon
          field={field}
          sortField={sortField}
          sortDirection={sortDirection}
        />
      </button>
    </TableHead>
  );

  return (
    <div className="custom-scrollbar overflow-x-auto w-full max-h-[500px] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
          <TableRow>
            {head("name", "Document Type")}
            {head("fileName", "File Name")}
            <TableHead className={plain}>Lender Remark</TableHead>
            {showImgcRemark && (
              <TableHead className={plain}>IMGC Remark</TableHead>
            )}
            <TableHead className={plain}>Uploaded By</TableHead>
            {head("dateTime", "Date/Time")}
            {/* Pinned to the right edge: the table is wider than the panel on a laptop screen, and
                an Upload/Reupload button that scrolls out of sight reads as "there is no button". */}
            {showActions && (
              <TableHead
                className={cn(
                  plain,
                  "sticky right-0 z-20 border-l border-neutral-200"
                )}
              >
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function ClaimDocumentsTable({
  accountId,
  claimId,
  documents,
  locked,
  allowDelete = true,
  bare = false,
  claimStatus,
}: Readonly<{
  accountId: string;
  claimId: string;
  documents: RequirementRow[];
  locked: boolean;
  /** Draft-only: once the claim is submitted the file belongs to IMGC's review and can be
   *  superseded by a re-upload, never removed. */
  allowDelete?: boolean;
  bare?: boolean;
  claimStatus?: string;
}>) {
  // No sort until a header is clicked: the list arrives mandatory-first in IMGC's configured
  // order, and that is the order the lender should work down.
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const sortDocs = useCallback(
    (docs: RequirementRow[]) => {
      if (!sortField) return docs;
      return [...docs].sort((a, b) => {
        const aFile = a.files[0];
        const bFile = b.files[0];
        let cmp = 0;
        switch (sortField) {
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "status":
            cmp = a.status.localeCompare(b.status);
            break;
          case "fileName":
            cmp = (aFile?.originalName || "").localeCompare(
              bFile?.originalName || ""
            );
            break;
          case "size":
            cmp = (aFile?.size || 0) - (bFile?.size || 0);
            break;
          case "dateTime":
            cmp = (aFile?.uploadedAt || "").localeCompare(
              bFile?.uploadedAt || ""
            );
            break;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
    },
    [sortField, sortDirection]
  );

  const isDraftStage = !claimStatus || claimStatus === "DRAFT";
  const required = useMemo(
    () =>
      sortDocs(
        documents.filter(
          (d) =>
            d.addedBy !== "LENDER" &&
            // Once the claim is initiated, an optional document nobody uploaded is just noise.
            (isDraftStage || d.required || d.files.length > 0)
        )
      ),
    [documents, isDraftStage, sortDocs]
  );
  const additional = useMemo(
    () => sortDocs(documents.filter((d) => d.addedBy === "LENDER")),
    [documents, sortDocs]
  );

  const [uploadTarget, setUploadTarget] = useState<{
    row: RequirementRow;
    mode: "upload" | "add" | "replace";
    replaceFileId?: string;
  } | null>(null);

  // While a delete is running every delete button is disabled, so a double click cannot remove a
  // second file.
  const [deleting, startDelete] = useTransition();

  const { ask, dialog: confirmDialog } = useConfirmDelete();

  const removeFile = useCallback(
    (accId: string, documentId: string, fileId: string) => {
      startDelete(async () => {
        const { deleteDocumentFileAction } =
          await import("@/app/[locale]/(portal)/additional-documents/actions");
        const result = await deleteDocumentFileAction(
          accId,
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

  // Deleting a file is not undoable, so the trash icon asks first.
  const onDelete = useCallback(
    (accId: string, documentId: string, fileId: string, fileName?: string) => {
      ask({
        description: fileName
          ? `"${fileName}" will be permanently deleted. This cannot be undone.`
          : "This file will be permanently deleted. This cannot be undone.",
        confirmLabel: "Delete file",
        onConfirm: () => removeFile(accId, documentId, fileId),
      });
    },
    [ask, removeFile]
  );

  const requiredActions = null;

  /**
   * Whether the lender may change this document now: while the claim is a draft or a query is
   * open with them, or when this document itself was sent back. Outside that, the buttons are not
   * shown at all — a greyed-out button only invites a click that cannot do anything.
   */
  const isModifiable = (doc: RequirementRow) =>
    !claimStatus ||
    claimStatus === "DRAFT" ||
    // In a query, a document IMGC has not decided on yet stays as it is — only a pending or
    // rejected one is the lender's to change.
    ((claimStatus === "QUERY_INITIATED" ||
      claimStatus === "QUERY_UNDER_REVIEW") &&
      (doc.status !== "UNDER_REVIEW" ||
        doc.files.some((f) => f.review?.decision === "REJECTED")));
  const canUpload = (doc: RequirementRow) =>
    !locked && doc.status !== "APPROVED" && isModifiable(doc);
  // Deleting is a draft-only act: once the claim is initiated a file is part of the record —
  // a rejected one is answered with Reupload, never removed.
  const canDelete = (doc: RequirementRow) =>
    allowDelete &&
    !locked &&
    doc.status !== "APPROVED" &&
    (!claimStatus || claimStatus === "DRAFT");
  const hasImgcDecision = (docs: RequirementRow[]) =>
    docs.some((d) => d.files.some((f) => f.review));
  const hasAnyAction = (docs: RequirementRow[]) =>
    docs.some((d) => canUpload(d) || (canDelete(d) && d.files.length > 0));

  // The lender can add documents only while the claim is still open to them: a draft, or a query
  // they are answering. Once it is initiated and with IMGC, there is nothing to add here - so the
  // Add button goes, and an Additional documents panel with nothing in it goes too.
  const claimOpenForChanges =
    !claimStatus ||
    claimStatus === "DRAFT" ||
    claimStatus === "QUERY_INITIATED" ||
    claimStatus === "QUERY_UNDER_REVIEW";
  // Same rule as ClaimDocuments: the Additional documents panel shows at initiation (draft), during
  // a query, or while a document stands rejected — otherwise hidden.
  const hasRejectedDoc = documents.some(
    (d) => d.status === "REJECTED" || d.status === "REUPLOAD_REQUIRED"
  );
  const showAdditional = claimOpenForChanges || hasRejectedDoc;

  const additionalActions =
    !locked && claimOpenForChanges ? (
      <AddLenderDocumentDialog accountId={accountId} claimId={claimId} />
    ) : null;

  const renderTableRows = (
    docs: RequirementRow[],
    showActions: boolean,
    showImgcRemark: boolean
  ) => {
    return docs.flatMap((doc) => {
      const hasFiles = doc.files.length > 0;
      const conditionalNotRequired = doc.conditional && !doc.required;

      const rowStyle = conditionalNotRequired ? "bg-neutral-50/50" : "";

      const docNameCell = (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] font-semibold leading-tight text-neutral-900">
            {doc.name}
            {doc.required && <span className="text-destructive ml-1">*</span>}
          </span>
          <div>
            <StatusChip status={doc.status} />
          </div>
          {doc.refNo && (
            <div className="flex flex-wrap gap-1">
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                {doc.refNo}
              </span>
            </div>
          )}
        </div>
      );

      const canUploadGeneral = canUpload(doc);

      const emptyAction =
        canUploadGeneral && !hasFiles ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onClick={() => setUploadTarget({ row: doc, mode: "upload" })}
          >
            <UploadIcon className="mr-1.5 size-3" /> Upload
          </Button>
        ) : null;

      if (!hasFiles) {
        return [
          <TableRow key={doc.id} className={rowStyle}>
            <TableCell className="w-[18%] px-2 py-1.5 align-top">
              {docNameCell}
            </TableCell>
            <TableCell
              colSpan={showImgcRemark ? 5 : 4}
              className="px-2 py-1.5 text-[11px] text-neutral-400 align-top"
            >
              Nothing uploaded yet.
            </TableCell>
            {showActions && (
              <TableCell className="px-3 py-2 align-top">
                {emptyAction}
              </TableCell>
            )}
          </TableRow>,
        ];
      }

      const hasAnyRejectedFile = doc.files.some(
        (f) => f.review?.decision === "REJECTED"
      );

      return doc.files.map((file, fileIndex) => {
        const isFirst = fileIndex === 0;
        const isThisFileRejected = file.review?.decision === "REJECTED";

        let fileAction = null;
        if (canUploadGeneral) {
          if (isThisFileRejected) {
            fileAction = (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onClick={() =>
                  setUploadTarget({
                    row: doc,
                    mode: "replace",
                    replaceFileId: file.id,
                  })
                }
              >
                <RotateCwIcon className="mr-1.5 size-3" /> Reupload
              </Button>
            );
          } else if (
            isFirst &&
            doc.status !== "REJECTED" &&
            doc.status !== "REUPLOAD_REQUIRED" &&
            !hasAnyRejectedFile
          ) {
            fileAction = (
              <Button
                variant="outline"
                size="xs"
                className="size-7 p-0"
                title="Add file"
                aria-label="Add file"
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onClick={() => setUploadTarget({ row: doc, mode: "add" })}
              >
                <PlusIcon className="size-4" />
              </Button>
            );
          }
        }

        return (
          <TableRow key={file.id} className={rowStyle}>
            {isFirst && (
              <>
                <TableCell
                  rowSpan={doc.files.length}
                  className="w-[18%] px-2 py-1.5 align-top border-r border-neutral-100"
                >
                  {docNameCell}
                </TableCell>
              </>
            )}
            <TableCell className="px-2 py-1.5 text-[11px] font-medium align-top">
              <a
                href={`/api/portal/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={file.originalName}
                className="text-brand-primary transition-colors hover:text-brand-dark hover:underline"
              >
                {clip(file.originalName, 18)}
              </a>
              {/* Size sits under the name, as on IMGC's Decision tab - no column of its own. */}
              <span className="block text-[10px] font-normal text-neutral-400">
                {formatBytes(file.size)}
              </span>
            </TableCell>
            <TableCell
              className="max-w-[150px] px-2 py-1.5 text-[10.5px] text-neutral-600 align-top"
              title={file.uploadRemarks?.trim() || undefined}
            >
              {file.uploadRemarks?.trim() ? (
                clip(file.uploadRemarks.trim(), 28)
              ) : (
                <span className="text-neutral-300">—</span>
              )}
            </TableCell>
            {showImgcRemark && (
              <TableCell className="max-w-[150px] px-2 py-1.5 align-top">
                {file.review ? (
                  <FileDecisionNote
                    review={file.review}
                    className="mt-0"
                    maxChars={28}
                  />
                ) : (
                  <span className="text-[10.5px] text-neutral-300">—</span>
                )}
              </TableCell>
            )}
            <TableCell className="px-2 py-1.5 text-[10.5px] text-neutral-500 align-top whitespace-nowrap">
              {file.uploadedByName || "—"}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-[10.5px] text-neutral-500 align-top whitespace-nowrap">
              {when(file.uploadedAt)}
            </TableCell>
            {showActions && (
              <TableCell className="px-3 py-2 align-top">
                <div className="flex items-center gap-1.5">
                  {canDelete(doc) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:hover:bg-transparent disabled:hover:text-destructive/50 disabled:opacity-50"
                      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                      onClick={() =>
                        onDelete(accountId, doc.id, file.id, file.originalName)
                      }
                      aria-label="Delete file"
                      disabled={deleting}
                      title="Delete file"
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  )}
                  {fileAction && <div>{fileAction}</div>}
                </div>
              </TableCell>
            )}
          </TableRow>
        );
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Required documents ───────────────────────────────── */}
      <Panel
        title="Required documents"
        className={bare ? "border-neutral-200 shadow-none" : undefined}
        actions={requiredActions}
      >
        <TableLayout
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          showActions={hasAnyAction(required)}
          showImgcRemark={hasImgcDecision(required)}
        >
          {renderTableRows(
            required,
            hasAnyAction(required),
            hasImgcDecision(required)
          )}
        </TableLayout>
      </Panel>

      {/* ── Additional documents ─────────────────────────────── */}
      {showAdditional && (
        <Panel
          title="Additional documents"
          className={bare ? "border-neutral-200 shadow-none" : undefined}
          actions={additionalActions}
        >
          {additional.length === 0 ? (
            <p className="px-5 py-4 text-center text-[13px] text-neutral-500">
              No additional documents added.
            </p>
          ) : (
            <TableLayout
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              showActions={hasAnyAction(additional)}
              showImgcRemark={hasImgcDecision(additional)}
            >
              {renderTableRows(
                additional,
                hasAnyAction(additional),
                hasImgcDecision(additional)
              )}
            </TableLayout>
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
    </div>
  );
}
