"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  FileTextIcon,
  MessageSquareWarningIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addRemarkAction,
  addRequirementAction,
  decideDocumentAction,
  decideReinstateAction,
  raiseQueryForRejectedDocumentAction,
  reactivateDocumentAction,
  requestReinstateAction,
  setRequirementActiveAction,
  submitClaimAction,
  uploadDocumentAction,
} from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { AddRequirementForm } from "@/components/portal/AddRequirementForm";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { daysUntil } from "@/constants/documents";
import { cn } from "@/lib/utils/twMergeUtils";
import type { DocumentRow, RequirementInput } from "@/services/portal/claims.server";
import type { ClaimStatus, Role } from "@/server/mock/types";

type Props = Readonly<{
  accountId: string;
  accountProduct: string;
  role: Role;
  docs: DocumentRow[];
  claimStatus: ClaimStatus;
  canSubmit: boolean;
  retentionDays: number;
  queriedDocNames: string[];
}>;

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysLeft(rejectedAt: string, retentionDays: number): number {
  const deadline = new Date(rejectedAt);
  deadline.setDate(deadline.getDate() + retentionDays);
  return Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
}

export function InitialClaimsTab({
  accountId,
  accountProduct,
  role,
  docs,
  claimStatus,
  canSubmit,
  retentionDays,
  queriedDocNames,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** Remarks typed against a row but not yet sent — what Save persists. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const isLender = role === "LENDER";
  const submitted = claimStatus === "SUBMITTED" || claimStatus === "APPROVED";
  const dirty = Object.values(drafts).some((v) => v.trim().length > 0);

  const setDraft = useCallback((docId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [docId]: value }));
  }, []);

  /** Persist every typed remark. Uploads already persist the moment they are chosen. */
  const persistDrafts = useCallback(async (): Promise<boolean> => {
    const entries = Object.entries(drafts).filter(([, v]) => v.trim());
    for (const [docId, body] of entries) {
      const result = await addRemarkAction(accountId, body, docId);
      if (!result.ok) {
        toast.error(result.error ?? "That remark could not be saved.");
        return false;
      }
    }
    setDrafts({});
    return true;
  }, [drafts, accountId]);

  const onSave = useCallback(() => {
    startTransition(async () => {
      if (!(await persistDrafts())) return;
      toast.success("Saved.");
      router.refresh();
    });
  }, [persistDrafts, router]);

  const onSaveAndSubmit = useCallback(() => {
    startTransition(async () => {
      if (!(await persistDrafts())) return;
      const result = await submitClaimAction(accountId);
      if (!result.ok) {
        toast.error(result.error ?? "The claim could not be submitted.");
        return;
      }
      toast.success("Initial claim submitted to IMGC.");
      router.refresh();
    });
  }, [persistDrafts, accountId, router]);

  const onCancel = useCallback(() => {
    setDrafts({});
    router.refresh();
    toast.info("Unsaved remarks discarded.");
  }, [router]);

  const onAddRequirement = useCallback(
    async (input: RequirementInput) => {
      const result = await addRequirementAction(accountId, input);
      if (result.ok) router.refresh();
      return result;
    },
    [accountId, router]
  );

  const onToggleActive = useCallback(
    (documentId: string, active: boolean) => {
      startTransition(async () => {
        const result = await setRequirementActiveAction(accountId, documentId, active);
        if (!result.ok) {
          toast.error(result.error ?? "That requirement could not be updated.");
          return;
        }
        toast.success(active ? "Requirement reactivated." : "Requirement withdrawn.");
        router.refresh();
      });
    },
    [accountId, router]
  );

  return (
    <div className="space-y-4">
      <Panel
        title="Initial claim documents"
        description={
          isLender
            ? "Upload each mandatory document. Submit becomes available once they are all in."
            : "Accept or reject what the lender has uploaded."
        }
      >

        <ul className="divide-y divide-neutral-100">
          {(isLender || !submitted
            ? docs
            : docs.filter(
                (d) => d.status !== "PENDING_UPLOAD" || d.addedBy === "IMGC"
              )
          ).map((doc) => (
            <DocumentRowItem
              key={doc.id}
              doc={doc}
              accountId={accountId}
              role={role}
              submitted={submitted}
              pending={pending}
              draft={drafts[doc.id] ?? ""}
              onDraftChange={setDraft}
              onToggleActive={onToggleActive}
              retentionDays={retentionDays}
              hasOpenQuery={queriedDocNames.includes(doc.name)}
            />
          ))}
        </ul>
      </Panel>

      {isLender && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-white px-5 py-3.5 shadow-sm">
          <p className="text-[12.5px] text-neutral-500">
            {canSubmit
              ? "Every mandatory document is in — you can submit this claim."
              : "Submit unlocks once every mandatory document has been uploaded."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={onSave} disabled={pending}>
              Save
            </Button>
            <Button
              size="sm"
              onClick={onSaveAndSubmit}
              disabled={pending || !canSubmit || submitted}
              title={
                canSubmit
                  ? undefined
                  : "Every mandatory document must be uploaded first"
              }
            >
              {submitted ? "Submitted" : "Save & Submit"}
            </Button>
          </div>
        </div>
      )}

      {isLender && dirty && (
        <p className="text-[12px] text-warning">
          You have unsaved remarks. Save keeps them; Cancel discards them.
        </p>
      )}
    </div>
  );
}

/* ── one checklist row ─────────────────────────────────────────────── */

function DocumentRowItem({
  doc,
  accountId,
  role,
  submitted,
  pending,
  draft,
  onDraftChange,
  onToggleActive,
  retentionDays,
  hasOpenQuery,
}: Readonly<{
  doc: DocumentRow;
  accountId: string;
  role: Role;
  submitted: boolean;
  pending: boolean;
  draft: string;
  onDraftChange: (docId: string, value: string) => void;
  onToggleActive: (documentId: string, active: boolean) => void;
  retentionDays: number;
  /** Does an open query already name this document — so a fresh rejection (already synced into
   *  a query) doesn't get a redundant "Raise Query" button. */
  hasOpenQuery: boolean;
}>) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isLender = role === "LENDER";
  const working = pending || busy;

  const onUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const data = new FormData();
      data.set("accountId", accountId);
      data.set("documentId", doc.id);
      data.set("file", file);
      startTransition(async () => {
        const result = await uploadDocumentAction(data);
        if (fileInput.current) fileInput.current.value = "";
        if (!result.ok) {
          toast.error(result.error ?? "That upload failed.");
          return;
        }
        toast.success(`"${doc.name}" uploaded.`);
        router.refresh();
      });
    },
    [accountId, doc.id, doc.name, router]
  );

  const decide = useCallback(
    (decision: "APPROVED" | "REJECTED", reason: string) => {
      startTransition(async () => {
        const result = await decideDocumentAction(
          accountId,
          doc.id,
          decision,
          reason
        );
        if (!result.ok) {
          toast.error(result.error ?? "That decision could not be recorded.");
          return;
        }
        toast.success(`"${doc.name}" ${decision.toLowerCase()}.`);
        setRejecting(false);
        router.refresh();
      });
    },
    [accountId, doc.id, doc.name, router]
  );

  const onReactivate = useCallback(() => {
    startTransition(async () => {
      const result = await reactivateDocumentAction(accountId, doc.id);
      if (!result.ok) {
        toast.error(result.error ?? "That could not be undone.");
        return;
      }
      toast.success(`"${doc.name}" is back under review.`);
      router.refresh();
    });
  }, [accountId, doc.id, doc.name, router]);

  const onRaiseQuery = useCallback(() => {
    startTransition(async () => {
      const result = await raiseQueryForRejectedDocumentAction(accountId, doc.id);
      if (!result.ok) {
        toast.error(result.error ?? "That query could not be raised.");
        return;
      }
      toast.success(`Query raised for "${doc.name}".`);
      router.refresh();
    });
  }, [accountId, doc.id, doc.name, router]);

  const onReinstateRequest = useCallback(() => {
    startTransition(async () => {
      const result = await requestReinstateAction(accountId, doc.id, "");
      if (!result.ok) {
        toast.error(result.error ?? "That request could not be sent.");
        return;
      }
      toast.success("Reinstatement requested — IMGC will review it.");
      router.refresh();
    });
  }, [accountId, doc.id, router]);

  const onReinstateDecision = useCallback(
    (approve: boolean) => {
      startTransition(async () => {
        const result = await decideReinstateAction(
          accountId,
          doc.id,
          approve,
          ""
        );
        if (!result.ok) {
          toast.error(result.error ?? "That decision could not be recorded.");
          return;
        }
        toast.success(approve ? "Reinstated." : "Reinstatement denied.");
        router.refresh();
      });
    },
    [accountId, doc.id, router]
  );

  const reinstate = doc.rejection?.reinstate;

  const inactive = doc.active === false;
  const due = doc.dueDate ? daysUntil(doc.dueDate) : null;
  const outstanding = doc.status === "PENDING_UPLOAD" || doc.status === "REJECTED";

  return (
    <li className={cn("block", inactive && "bg-neutral-25 opacity-60")}>
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none focus:ring-inset focus:ring-2 focus:ring-brand-primary/20"
      >
        <div className="flex flex-wrap items-center gap-2">
          <FileTextIcon className="size-4 shrink-0 text-neutral-400" />
          <span className="text-[13.5px] font-semibold text-neutral-950">
            {doc.name}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
              doc.required
                ? "bg-neutral-100 text-neutral-600"
                : "bg-neutral-50 text-neutral-400"
            )}
          >
            {doc.required ? "Mandatory" : "Optional"}
          </span>
          {doc.addedBy === "IMGC" && (
            <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-dark">
              Added by IMGC
            </span>
          )}
          <StatusPill status={doc.status} />
          {inactive && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-600">
              Withdrawn
            </span>
          )}
          {due !== null && outstanding && !inactive && (
            <span
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                due < 0
                  ? "bg-destructive/10 text-destructive"
                  : due <= 3
                    ? "bg-warning/15 text-warning"
                    : "bg-neutral-100 text-neutral-600"
              )}
            >
              <CalendarClockIcon className="size-3" />
              {due < 0
                ? `Overdue by ${Math.abs(due)}d`
                : due === 0
                  ? "Due today"
                  : `Due in ${due}d`}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center pl-2">
          <ChevronDownIcon
            className={cn(
              "size-4 text-neutral-400 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Accordion Content */}
      {expanded && (
        <div className="border-t border-neutral-100/50 bg-neutral-25/30 px-5 pb-4 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">

          {isLender && (doc.category || doc.applicableProduct || doc.applicableCaseType) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-neutral-500">
              {doc.category && <span className="font-medium">{doc.category}</span>}
              {doc.applicableProduct && <span>· {doc.applicableProduct}</span>}
              {doc.applicableCaseType && <span>· {doc.applicableCaseType}</span>}
              {doc.addedByName && <span>· added by {doc.addedByName}</span>}
            </p>
          )}

          {doc.description && (
            <p
              className={cn(
                "mt-1.5 text-[12px] text-neutral-700",
                role === "IMGC"
                  ? ""
                  : "rounded-md border border-brand-primary/15 bg-brand-light/50 px-2.5 py-1.5 leading-relaxed"
              )}
            >
              {doc.description}
            </p>
          )}

          {doc.requirementRemarks && role === "IMGC" && (
            <p className="mt-1 text-[11.5px] italic text-neutral-500">
              IMGC note: {doc.requirementRemarks}
            </p>
          )}

          {doc.file ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-500">
              <PaperclipIcon className="size-3.5" />
              <span className="font-medium text-neutral-700">
                {doc.file.originalName}
              </span>
              <span>· {bytes(doc.file.size)}</span>
              <span>
                · {doc.file.uploadedByName}, {when(doc.file.uploadedAt)}
              </span>
              {doc.history.length > 1 && (
                <span className="text-neutral-400">
                  · {doc.history.length} versions
                </span>
              )}
              {doc.file.storedPath ? (
                // A real upload has real bytes on disk — open the actual file (its own tab's
                // native PDF viewer gives a download button for free) instead of a mockup.
                <a
                  href={`/api/portal/files/${doc.file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-primary"
                >
                  <EyeIcon className="size-3" /> View
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewing(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-primary"
                >
                  <EyeIcon className="size-3" /> View
                </button>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-neutral-400">
              Nothing uploaded yet.
            </p>
          )}

          {doc.rejection && (
            <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2">
              <p className="text-[12.5px] text-destructive">
                <span className="font-semibold">Rejected</span> by{" "}
                {doc.rejection.by} on {when(doc.rejection.at)} — {doc.rejection.reason}
              </p>
              <p className="mt-0.5 text-[11.5px] text-neutral-500">
                Kept for {retentionDays} days ·{" "}
                {reinstate?.status === "REQUESTED"
                  ? "held pending a reinstatement decision"
                  : `${Math.max(0, daysLeft(doc.rejection.at, retentionDays))} days left`}
              </p>
              {reinstate && (
                <p className="mt-1">
                  <StatusPill status={reinstate.status} />
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {isLender && reinstate?.status !== "REQUESTED" && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={onReinstateRequest}
                    disabled={working}
                  >
                    <RotateCcwIcon /> Request reinstatement
                  </Button>
                )}
                {role === "IMGC" && reinstate?.status === "REQUESTED" && (
                  <>
                    <Button
                      size="xs"
                      variant="success"
                      onClick={() => onReinstateDecision(true)}
                      disabled={working}
                    >
                      Approve reinstatement
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onReinstateDecision(false)}
                      disabled={working}
                    >
                      Deny
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Row actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isLender && doc.status !== "APPROVED" && !submitted && (
            <>
              <input
                ref={fileInput}
                type="file"
                id={`file-${doc.id}`}
                onChange={onUpload}
                disabled={working}
                className="hidden"
              />
              {/* A label, not a Button: it has to drive the hidden file input, and a <label
                  for> is the one control that opens the picker without any JavaScript. */}
              <label
                htmlFor={`file-${doc.id}`}
                aria-disabled={working}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                  working && "pointer-events-none opacity-50",
                  doc.status === "PENDING_UPLOAD"
                    ? "bg-primary text-primary-foreground hover:bg-brand-dark"
                    : "border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
                )}
              >
                <UploadIcon className="size-3.5" />
                {doc.status === "PENDING_UPLOAD" ? "Upload" : "Replace"}
              </label>
            </>
          )}

          {role === "IMGC" && doc.status === "UNDER_REVIEW" && !rejecting && (
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="success"
                onClick={() => decide("APPROVED", "")}
                disabled={working}
              >
                <CheckIcon /> Accept
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setRejecting(true)}
                disabled={working}
              >
                <XIcon /> Reject
              </Button>
            </div>
          )}

          {/* A rejected document is IMGC's to walk back (the rejection was the mistake, not the
              document), and — only when nothing already raised one — theirs to turn into a
              proper query too, for a document rejected before that started happening
              automatically. A fresh rejection already has an open query, so this stays hidden. */}
          {role === "IMGC" && doc.status === "REJECTED" && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={onReactivate}
                disabled={working}
                title="Undo the rejection — the document goes back under review"
              >
                <RotateCcwIcon /> Undo Rejection
              </Button>
              {!hasOpenQuery && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={onRaiseQuery}
                  disabled={working}
                  title="This rejection has no open query yet — raise one so the lender sees it"
                >
                  <MessageSquareWarningIcon /> Raise Query
                </Button>
              )}
            </div>
          )}

          {/* Only an IMGC-authored requirement can be withdrawn — the standard checklist is not
              the processor's to remove. Withdrawing keeps the row and its history. */}
          {role === "IMGC" && doc.addedBy === "IMGC" && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onToggleActive(doc.id, inactive)}
              disabled={working}
              title={
                inactive
                  ? "Ask the lender for this document again"
                  : "Stop asking for this document — it will not block submission"
              }
            >
              {inactive ? <RotateCcwIcon /> : <BanIcon />}
              {inactive ? "Reactivate" : "Withdraw"}
            </Button>
          )}
        </div>
      </div>

      {rejecting && role === "IMGC" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-neutral-25 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            decide("REJECTED", reason);
          }}
        >
          <label className="min-w-[260px] flex-1">
            <span className="mb-1 block text-[12px] font-medium text-neutral-700">
              Reason for rejection
            </span>
            <input
              name="reason"
              required
              // The reason box appears only after Reject is pressed, and a rejection cannot
              // be filed without it.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              placeholder="e.g. Valuation report is older than 6 months"
              className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>
          <Button type="submit" size="sm" variant="destructive" disabled={working}>
            Reject document
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRejecting(false)}
          >
            Cancel
          </Button>
        </form>
      )}

          {/* Per-document remark */}
          {isLender && (
            <div className="mt-3">
              <input
                value={draft}
                onChange={(e) => onDraftChange(doc.id, e.target.value)}
                placeholder="Add a remark against this document…"
                aria-label={`Remark on ${doc.name}`}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[12.5px] outline-none placeholder:text-neutral-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          )}
        </div>
      )}

      {doc.file && (
        <DocumentPreviewDialog
          file={doc.file}
          open={previewing}
          onOpenChange={setPreviewing}
        />
      )}
    </li>
  );
}

/**
 * Fallback for a file with no real bytes on disk — every document seeded into the demo data,
 * before a real upload replaces it. A real upload opens straight in a new tab via
 * `/api/portal/files/[fileId]` instead (see the `doc.file.storedPath` check above this dialog's
 * only remaining caller); this stays only so a seeded row's "View" isn't a dead click. Same idiom
 * as `ReviewDrawer`'s Preview section, so a reviewer sees the same shape whether the document sits
 * in an additional-document requirement or a claim's own checklist.
 */
function DocumentPreviewDialog({
  file,
  open,
  onOpenChange,
}: Readonly<{
  file: DocumentRow["file"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  if (!file) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="truncate text-[15px]">
            {file.originalName}
          </DialogTitle>
          <DialogDescription>
            {file.uploadedByName} · {when(file.uploadedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="mx-auto flex aspect-[1/1.3] w-full max-w-[240px] flex-col rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <FileTextIcon className="size-4 text-destructive" />
              <span className="truncate text-[11px] font-semibold text-neutral-700">
                {file.originalName}
              </span>
            </div>
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
              Demo preview · {bytes(file.size)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
