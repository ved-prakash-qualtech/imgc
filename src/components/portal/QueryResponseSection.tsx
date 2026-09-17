"use client";

import { type ChangeEvent, useCallback, useState, useTransition } from "react";
import { SendIcon, FileTextIcon, PaperclipIcon } from "lucide-react";
import { toast } from "sonner";

import { submitClaimAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { ClaimQuery, ClaimStatus, Remark } from "@/server/mock/types";

const RESPONSE_MAX = 2000;

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** What to say when there's nothing to respond to — worded to the claim's actual state rather
 *  than one generic line, so "check back later" doesn't sound identical to "already reviewed". */
function noQueryMessage(status: ClaimStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "No active query.";
    case "UNDER_REVIEW":
    case "DOCUMENTS_RESUBMITTED":
      return "No active query. Claim is currently under review.";
    case "APPROVED":
    case "REJECTED":
    case "CLOSED":
      return "No active query. This claim has been decided.";
    case "REFUND_RECEIVED_BY_IMGC":
      return "No active query. This claim has been decided, and the refund has been received by IMGC.";
    default:
      return "No active query.";
  }
}

/**
 * Query Response — a section inside Track Claim, not a page of its own.
 *
 * Visibility is driven entirely by `claim.openQuery`: it exists iff the claim's status is
 * QUERY_RAISED (`decorate()` in claimFlow.server.ts derives it that way), so there is nothing here
 * that tracks "has a query been raised" separately from the claim record itself. The response text
 * is stored as an ordinary claim field (`__queryResponse`) — Save persists it via `saveDraftAction`
 * without touching status, and Submit runs it through the same `submitClaimAction` /
 * `checkSubmittable` gate every other submission uses, which is also what resolves the query.
 */
export function QueryResponseSection({
  accountId,
  claimId,
  claimStatus,
  openQuery,
  queries,
  claimRemarks,
  savedResponse,
  documents,
  isLender,
  imgcComposer,
  title = "Query Management",
  fillLayout = false,
}: Readonly<{
  accountId: string;
  claimId: string;
  claimStatus: ClaimStatus;
  openQuery: ClaimQuery | null;
  queries: ClaimQuery[];
  claimRemarks: Remark[];
  savedResponse: string;
  documents: RequirementRow[];
  isLender: boolean;
  imgcComposer?: React.ReactNode;
  title?: string;
  constrainedLayout?: boolean;
  fillLayout?: boolean;
}>) {
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState(savedResponse);

  const handleResponseChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setResponse(e.target.value);
    },
    []
  );

  const onSubmit = useCallback(() => {
    if (!response.trim()) {
      toast.error("Enter a response before submitting.");
      return;
    }
    startTransition(async () => {
      const result = await submitClaimAction(accountId, claimId, {
        __queryResponse: response,
      });
      if (!result.ok) {
        toast.error(result.error ?? "The response could not be submitted.");
        return;
      }
      setResponse("");
      toast.success("Response submitted — back with IMGC for review.");
    });
  }, [accountId, claimId, response]);

  const hasUploadRemarks = documents.some((doc) =>
    doc.files.some((file) => file.uploadRemarks?.trim())
  );

  if (queries.length === 0 && claimRemarks.length === 0 && !hasUploadRemarks) {
    if (!isLender && imgcComposer) {
      return (
        <Panel
          title={title ?? "Query Management"}
        >
          <div>
            {imgcComposer}
          </div>
        </Panel>
      );
    }

    return (
      <Panel
        title={title}
        size="compact"
      >
        <p className="flex flex-1 items-center justify-center px-5 py-8 text-center text-[13px] text-neutral-500">
          {noQueryMessage(claimStatus)}
        </p>
      </Panel>
    );
  }

  /** The requested documents are named, not referenced by id, so match them back to the claim's
   *  own rows to show what state each one is actually in. */
  const docByName = new Map(documents.map((doc) => [doc.name, doc]));

  /**
   * Remarks typed on the upload form, shown in the thread alongside the typed-out ones.
   *
   * They are part of the same conversation — "here is the statement you asked for, page 3 is the
   * one that matters" — but they were only visible to IMGC inside the review drawer, so the
   * lender could not see what they had written and IMGC had to open a document to find it.
   * Attributed by who uploaded the file; a file from before that was recorded reads as the
   * lender's, which is who uploaded in every flow that existed then.
   */
  const documentRemarks = documents.flatMap((doc) =>
    doc.files
      .filter((file) => file.uploadRemarks?.trim())
      .map((file) => ({
        id: `upload_${file.id}`,
        createdAt: file.uploadedAt,
        authorName: file.uploadedByName,
        authorRole: file.uploadedByRole ?? ("LENDER" as const),
        body: file.uploadRemarks!.trim(),
        documentLabel: `${doc.name} · ${file.originalName}`,
      }))
  );

  const messages = [
    ...claimRemarks.map((remark) => ({
      id: remark.id,
      createdAt: remark.createdAt,
      authorName: remark.authorName,
      authorRole: remark.authorRole,
      body: remark.body,
      documentLabel: undefined as string | undefined,
    })),
    ...documentRemarks,
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Panel
      title={title}
      size="compact"
      // Height follows the conversation. Only `fillLayout` stretches to a parent that sets a height
      // on purpose; everywhere else a short thread stays short and a long one scrolls inside the
      // message list rather than stretching the page.
      className={
        fillLayout ? "flex h-full min-h-0 flex-col overflow-hidden" : undefined
      }
    >
      <div
        className={
          fillLayout
            ? "flex-1 min-h-0 overflow-y-auto space-y-3 px-4 py-4 custom-scrollbar"
            : "max-h-[360px] overflow-y-auto space-y-3 px-4 py-4 custom-scrollbar"
        }
      >
        {messages
          .map((remark) => {
            const isLender = remark.authorRole === "LENDER";
            return isLender ? (
              <div key={remark.id} className="flex justify-end">
                <div className="w-full max-w-2xl rounded-lg rounded-tr-sm border border-brand-primary/10 bg-brand-primary/5 px-2.5 py-1.5 shadow-sm">
                  <div className="mb-1 flex flex-wrap items-baseline justify-end gap-1.5 text-[11.5px] text-neutral-500">
                    <span>{when(remark.createdAt)}</span>
                    <span>&middot; {remark.authorName}</span>
                    <span className="font-semibold text-brand-primary">
                      &middot; Lender
                    </span>
                  </div>
                  {remark.documentLabel && (
                    <p className="mb-0.5 text-right text-[11px] font-medium text-neutral-500">
                      <PaperclipIcon className="mr-1 inline size-3 align-[-1px]" />
                      {remark.documentLabel}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[12px] font-semibold text-neutral-800">
                    {remark.body}
                  </p>
                </div>
              </div>
            ) : (
              <div key={remark.id} className="flex justify-start">
                <div className="w-full max-w-2xl rounded-lg rounded-tl-sm border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 shadow-sm">
                  <div className="mb-1 flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-neutral-500">
                    <span className="font-semibold text-brand-primary">
                      IMGC
                    </span>
                    <span>&middot; {remark.authorName}</span>
                    <span>&middot; {when(remark.createdAt)}</span>
                  </div>
                  {remark.documentLabel && (
                    <p className="mb-0.5 text-[11px] font-medium text-neutral-500">
                      <PaperclipIcon className="mr-1 inline size-3 align-[-1px]" />
                      {remark.documentLabel}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[12px] font-semibold text-neutral-800">
                    {remark.body}
                  </p>
                </div>
              </div>
            );
          })}
        {/* Sort ascending so the oldest message is at top and the latest is at the bottom */}
        {[...queries]
          .sort((a, b) => a.raisedAt.localeCompare(b.raisedAt))
          .map((q) => {
            /**
             * Link lender-uploaded documents to this query by timestamp.
             *
             * The domain model has no FK from ClaimDocument → ClaimQuery.  When the lender
             * responds (`submitClaim`), the open query gets `respondedAt = nowIso()` and the
             * document they added just beforehand already has its `createdAt` written. Both calls
             * happen within the same user interaction, so the document's `addedOn` always falls
             * in the half-open window [raisedAt, respondedAt].  Only LENDER-added documents are
             * candidates — SYSTEM docs belong to the checklist, not a response.
             */
            const respondedDocs = q.respondedAt
              ? documents.filter(
                  (d) =>
                    d.addedBy === "LENDER" &&
                    d.addedOn >= q.raisedAt &&
                    d.addedOn <= q.respondedAt!
                )
              : [];
            return (
              <div key={q.id} className="space-y-3">
                {/* ── IMGC Query (Left) ── */}
                <div className="flex justify-start">
                  <div className="w-full max-w-2xl rounded-lg rounded-tl-sm border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 shadow-sm">
                    <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-neutral-500">
                        <span className="font-semibold text-brand-primary">
                          IMGC
                        </span>
                        {q.raisedByName && (
                          <span>&middot; {q.raisedByName}</span>
                        )}
                        <span>&middot; {when(q.raisedAt)}</span>
                      </div>
                      {/* Moved up next to the header instead of its own labelled section below —
                        one or two short document names don't need a full row of vertical space
                        to themselves. */}
                      {q.requestedDocuments.length > 0 && (
                        <ul className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          {q.requestedDocuments.map((name) => {
                            const doc = docByName.get(name);
                            const rejected = doc?.status === "REJECTED";
                            return (
                              <li
                                key={name}
                                title={
                                  rejected
                                    ? (doc?.review?.remarks ??
                                      "Rejected by IMGC.")
                                    : undefined
                                }
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                                  rejected
                                    ? "bg-destructive/5 text-neutral-800 ring-destructive/30"
                                    : "bg-white text-neutral-800 ring-neutral-200"
                                )}
                              >
                                {name}
                                {rejected && (
                                  <span className="rounded-full bg-destructive/12 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                                    Rejected
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] font-semibold text-neutral-800">
                      {q.reason}
                    </p>
                  </div>
                </div>

                {/* ── Lender Response (Right) ── */}
                {q.respondedAt && (
                  <div className="flex justify-end">
                    <div className="w-full max-w-2xl rounded-lg rounded-tr-sm border border-brand-primary/10 bg-brand-primary/5 px-2.5 py-1.5 shadow-sm">
                      <div className="mb-1 flex flex-wrap items-baseline justify-end gap-1.5 text-[11.5px] text-neutral-500">
                        <span>{when(q.respondedAt)}</span>
                        {q.respondedByName && (
                          <span>&middot; {q.respondedByName}</span>
                        )}
                        <span className="font-semibold text-brand-primary">
                          &middot; Lender
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[12px] font-semibold text-neutral-800">
                        {q.responseRemarks || "No remarks provided."}
                      </p>
                      {respondedDocs.length > 0 && (
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          {respondedDocs.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center gap-1.5 rounded-md border border-brand-primary/10 bg-brand-light/20 px-2 py-1 shadow-sm"
                            >
                              <FileTextIcon className="size-3.5 shrink-0 text-brand-primary" />
                              <span className="truncate text-[11.5px] font-medium text-brand-dark max-w-[200px]">
                                {d.name}
                              </span>
                              {d.file?.id ? (
                                <>
                                  <span className="text-brand-primary/30">
                                    &middot;
                                  </span>
                                  <a
                                    href={`/api/portal/files/${d.file.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-brand-primary hover:underline"
                                  >
                                    View document
                                  </a>
                                </>
                              ) : (
                                <>
                                  <span className="text-brand-primary/30">
                                    &middot;
                                  </span>
                                  <span className="text-[11px] text-neutral-400">
                                    No file
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* ── Open Query Composer ── */}
      {openQuery ? (
        <div className="shrink-0 border-t border-neutral-100 bg-neutral-50 p-1">
          {!isLender ? (
            imgcComposer ? (
              imgcComposer
            ) : (
              <p className="text-center text-[12.5px] italic text-neutral-500">
                Awaiting lender response...
              </p>
            )
          ) : (
            <div className="mx-auto w-full space-y-1">
              <div className="flex items-end gap-1.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
                <textarea
                  id="query-response"
                  value={response}
                  maxLength={RESPONSE_MAX}
                  onChange={handleResponseChange}
                  rows={1}
                  placeholder="Type your response to the query..."
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] outline-none max-h-[160px] custom-scrollbar"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={{ fieldSizing: "content" } as any}
                />

                <Button
                  type="button"
                  size="icon"
                  className="shrink-0 size-8 rounded-full bg-brand-primary hover:bg-brand-primary/90 text-white"
                  onClick={onSubmit}
                  disabled={pending || !response.trim()}
                  title="Send Response"
                >
                  <SendIcon className="size-[15px]" />
                  <span className="sr-only">Send Response</span>
                </Button>
              </div>

              <div className="flex items-center justify-between px-2 text-[11px] text-neutral-400">
                <span>
                  {response.trim()
                    ? ""
                    : "Response is required before sending."}
                </span>
                <span>
                  {response.length}/{RESPONSE_MAX}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        !isLender &&
        imgcComposer && (
          <div className="shrink-0 border-t border-neutral-100 bg-neutral-50 p-3">
            {imgcComposer}
          </div>
        )
      )}
    </Panel>
  );
}
