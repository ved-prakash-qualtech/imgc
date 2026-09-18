"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { ArrowUpDownIcon, ChevronDownIcon, ChevronUpIcon, FileIcon, PlusIcon, TrashIcon, UploadIcon, RotateCwIcon } from "lucide-react";
import { toast } from "sonner";

import { AddLenderDocumentDialog } from "@/components/portal/AddLenderDocumentDialog";
import { FileDecisionNote } from "@/components/portal/FileDecisionNote";
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

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
  sortField: SortField;
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
}: {
  children: React.ReactNode;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  /** Drop the Actions column entirely when nothing in the table can be acted on. */
  showActions: boolean;
}) {
  const head = (field: SortField, label: string) => (
    <TableHead className="h-9 bg-neutral-50 px-3 text-[11px] uppercase tracking-wider text-neutral-500">
      <button
        type="button"
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClick={() => onSort(field)}
        className="flex select-none items-center uppercase hover:text-neutral-700"
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
            {head("status", "Status")}
            {head("fileName", "File Name")}
            {head("size", "Size")}
            {head("dateTime", "Date/Time")}
            {showActions && (
              <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wider text-neutral-500 bg-neutral-50">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {children}
        </TableBody>
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
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField]);

  const sortDocs = useCallback((docs: RequirementRow[]) => {
    return [...docs].sort((a, b) => {
      const aFile = a.files[0];
      const bFile = b.files[0];
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "fileName": cmp = (aFile?.originalName || "").localeCompare(bFile?.originalName || ""); break;
        case "size": cmp = (aFile?.size || 0) - (bFile?.size || 0); break;
        case "dateTime": cmp = (aFile?.uploadedAt || "").localeCompare(bFile?.uploadedAt || ""); break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [sortField, sortDirection]);

  const required = useMemo(
    () => sortDocs(documents.filter((d) => d.addedBy !== "LENDER")),
    [documents, sortDocs]
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
        const { deleteDocumentFileAction } = await import(
          "@/app/[locale]/(portal)/additional-documents/actions"
        );
        const result = await deleteDocumentFileAction(accId, documentId, fileId);
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
    claimStatus === "QUERY_INITIATED" ||
    claimStatus === "QUERY_UNDER_REVIEW" ||
    doc.status === "REJECTED" ||
    doc.status === "REUPLOAD_REQUIRED";
  const canUpload = (doc: RequirementRow) =>
    !locked && doc.status !== "APPROVED" && isModifiable(doc);
  const canDelete = (doc: RequirementRow) =>
    !locked &&
    doc.status !== "APPROVED" &&
    (allowDelete || (claimStatus !== undefined && isModifiable(doc)));
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
  // An empty Additional documents panel belongs to a draft only: once the claim has been
  // initiated - including while a query is being worked on - an empty panel is noise. A panel
  // that already holds documents always stays, so they remain visible.
  const showAdditional =
    !claimStatus || claimStatus === "DRAFT" || additional.length > 0;

  const additionalActions = !locked && claimOpenForChanges ? (
    <AddLenderDocumentDialog accountId={accountId} claimId={claimId} />
  ) : null;

  const renderTableRows = (docs: RequirementRow[], showActions: boolean) => {
    return docs.flatMap((doc, docIndex) => {
      const hasFiles = doc.files.length > 0;
      const conditionalNotRequired = doc.conditional && !doc.required;
      
      const rowStyle = conditionalNotRequired ? "bg-neutral-50/50" : "";


      const docNameCell = (
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-neutral-900">
            {doc.name}{doc.required && <span className="text-destructive ml-1">*</span>}
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {doc.refNo && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-neutral-500">
                {doc.refNo}
              </span>
            )}
          </div>
        </div>
      );

      const statusCell = <StatusChip status={doc.status} />;
      
      const mainAction = canUpload(doc) ? (
        !hasFiles ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setUploadTarget({ row: doc, mode: "upload" })}
          >
            <UploadIcon className="mr-1.5 size-3" /> Upload
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setUploadTarget({ row: doc, mode: "add" })}
          >
            {doc.status === "REJECTED" ? (
              <><RotateCwIcon className="mr-1.5 size-3" /> Reupload</>
            ) : (
              <><PlusIcon className="mr-1.5 size-3" /> Add File</>
            )}
          </Button>
        )
      ) : null;

      if (!hasFiles) {
        return [
          <TableRow key={doc.id} className={rowStyle}>
            <TableCell className="w-[30%] py-3 align-top">{docNameCell}</TableCell>
            <TableCell className="py-3 align-top">{statusCell}</TableCell>
            <TableCell className="py-3 text-[12px] text-neutral-400 align-top">Nothing uploaded yet.</TableCell>
            <TableCell className="py-3 text-[12px] text-neutral-400 align-top">—</TableCell>
            <TableCell className="py-3 text-[12px] text-neutral-400 align-top">—</TableCell>
            {showActions && <TableCell className="py-3 align-top">{mainAction}</TableCell>}
          </TableRow>
        ];
      }

      return doc.files.map((file, fileIndex) => {
        const isFirst = fileIndex === 0;
        return (
          <TableRow key={file.id} className={rowStyle}>
            {isFirst && (
              <>
                <TableCell rowSpan={doc.files.length} className="w-[30%] py-3 align-top border-r border-neutral-100">
                  {docNameCell}
                </TableCell>
                <TableCell rowSpan={doc.files.length} className="py-3 align-top border-r border-neutral-100">
                  {statusCell}
                </TableCell>
              </>
            )}
            <TableCell className="py-3 text-[12.5px] font-medium align-middle">
              <a
                href={`/api/portal/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-primary transition-colors hover:text-brand-dark hover:underline"
              >
                <FileIcon className="size-4 shrink-0 text-neutral-400" />
                <span className="truncate max-w-[150px] sm:max-w-[200px]" title={file.originalName}>
                  {file.originalName}
                </span>
              </a>
              <FileDecisionNote review={file.review} className="max-w-[260px] pl-6" />
            </TableCell>
            <TableCell className="py-3 text-[12.5px] text-neutral-600 align-middle whitespace-nowrap">
              {formatBytes(file.size)}
            </TableCell>
            <TableCell className="py-3 text-[12.5px] text-neutral-600 align-middle whitespace-nowrap">
              {when(file.uploadedAt)}
            </TableCell>
            {showActions && (
            <TableCell className="py-3 align-middle">
              <div className="flex items-center gap-1.5">
                {canDelete(doc) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:hover:bg-transparent disabled:hover:text-destructive/50 disabled:opacity-50"
                    // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onClick={() => onDelete(accountId, doc.id, file.id, file.originalName)}
                    aria-label="Delete file"
                    disabled={deleting}
                    title="Delete file"
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                )}
                {isFirst && mainAction && <div>{mainAction}</div>}
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
        title={
          <div className="flex items-baseline gap-2">
            Required documents
          </div>
        }
        className={bare ? "border-neutral-200 shadow-none" : undefined}
        actions={requiredActions}
      >
        <TableLayout sortField={sortField} sortDirection={sortDirection} onSort={handleSort} showActions={hasAnyAction(required)}>
          {renderTableRows(required, hasAnyAction(required))}
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
          <TableLayout sortField={sortField} sortDirection={sortDirection} onSort={handleSort} showActions={hasAnyAction(additional)}>
            {renderTableRows(additional, hasAnyAction(additional))}
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
