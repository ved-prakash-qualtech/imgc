"use client";

import { type ChangeEvent, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon, FileTextIcon, PaperclipIcon } from "lucide-react";
import { toast } from "sonner";

import { submitClaimAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { ClaimDocuments } from "@/components/portal/ClaimDocuments";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { ClaimQuery, ClaimStatus } from "@/server/mock/types";

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
  savedResponse,
  documents,
  isLender,
  imgcComposer,
  title = "Query Response",
  constrainedLayout = false,
  fillLayout = false,
}: Readonly<{
  accountId: string;
  claimId: string;
  claimStatus: ClaimStatus;
  openQuery: ClaimQuery | null;
  queries: ClaimQuery[];
  savedResponse: string;
  documents: RequirementRow[];
  isLender: boolean;
  imgcComposer?: React.ReactNode;
  title?: string;
  constrainedLayout?: boolean;
  fillLayout?: boolean;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState(savedResponse);
  const [attachOpen, setAttachOpen] = useState(false);

  const closeAttachModal = useCallback(() => setAttachOpen(false), []);

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
      router.refresh();
    });
  }, [accountId, claimId, response, router]);

  if (queries.length === 0) {
    if (!isLender && imgcComposer) {
      return (
        <Panel
          title="Processing outcome"
          className={
            constrainedLayout || fillLayout
              ? "flex h-full min-h-0 flex-col overflow-hidden"
              : undefined
          }
        >
          <div className={constrainedLayout ? "shrink-0" : undefined}>
            {imgcComposer}
          </div>
        </Panel>
      );
    }

    return (
      <Panel
        title={title}
        description="Only actionable while IMGC has an open query on this claim."
        className={
          constrainedLayout || fillLayout
            ? "flex h-full min-h-0 flex-col overflow-hidden"
            : undefined
        }
      >
        <p className="flex flex-1 items-center justify-center px-5 py-8 text-center text-[13px] text-neutral-500">
          {noQueryMessage(claimStatus)}
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={title}
      description="Communication between IMGC and the Lender regarding this claim."
      className={
        constrainedLayout || fillLayout
          ? "flex h-full min-h-0 flex-col overflow-hidden"
          : undefined
      }
    >
      <div
        className={
          constrainedLayout
            ? "min-h-0 flex-1 overflow-y-auto space-y-3 px-4 py-4 custom-scrollbar max-h-[300px]"
            : "flex-1 min-h-0 overflow-y-auto space-y-3 px-4 py-4 custom-scrollbar"
        }
      >
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
                  <div className="w-full max-w-2xl rounded-lg rounded-tl-sm border border-neutral-200 bg-neutral-50 px-3 py-2 shadow-sm">
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
                          {q.requestedDocuments.map((name) => (
                            <li
                              key={name}
                              className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-800 ring-1 ring-neutral-200"
                            >
                              {name}
                            </li>
                          ))}
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
                    <div className="w-full max-w-2xl rounded-lg rounded-tr-sm border border-brand-primary/10 bg-brand-primary/5 px-3 py-2 shadow-sm">
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

                <div className="flex shrink-0 items-center gap-1">
                  <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
                    <DialogTrigger
                      className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
                      title="Attach documents"
                    >
                      <PaperclipIcon className="size-[18px]" />
                      <span className="sr-only">Attach documents</span>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[85vh] w-full sm:max-w-4xl flex-col overflow-hidden p-0">
                      <DialogHeader className="shrink-0 border-b border-neutral-100 px-5 py-4">
                        <DialogTitle className="text-lg">
                          Attach Documents
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto bg-neutral-50/50 px-5 py-4 custom-scrollbar">
                        <ClaimDocuments
                          accountId={accountId}
                          claimId={claimId}
                          documents={documents}
                          locked={false}
                          bare
                        />
                      </div>
                      <div className="flex shrink-0 justify-end border-t border-neutral-100 bg-white px-5 py-3">
                        <Button variant="outline" onClick={closeAttachModal}>
                          Done
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    type="button"
                    size="icon"
                    className="size-8 rounded-full bg-brand-primary hover:bg-brand-primary/90 text-white"
                    onClick={onSubmit}
                    disabled={pending || !response.trim()}
                    title="Send Response"
                  >
                    <SendIcon className="size-[15px]" />
                    <span className="sr-only">Send Response</span>
                  </Button>
                </div>
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
