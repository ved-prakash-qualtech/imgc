"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  MessageSquareWarningIcon,
  SaveIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  saveDraftAction,
  submitClaimAction,
} from "@/app/[locale]/(portal)/initiate-claim/actions";
import { ClaimDocuments } from "@/components/portal/ClaimDocuments";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
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

/** The short id a lender sees, e.g. "qry_a1b2c3d4" → "QRY-A1B2C3D4". */
function displayQueryId(id: string): string {
  return `QRY-${id.replace(/^qry_/, "").slice(0, 8).toUpperCase()}`;
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
  lastAnsweredQuery,
  savedResponse,
  documents,
  isLender,
}: Readonly<{
  accountId: string;
  claimId: string;
  claimStatus: ClaimStatus;
  openQuery: ClaimQuery | null;
  /** The most recent resolved query, so a just-submitted response still reads back here —
   *  read-only — instead of the section going blank the moment the query closes. */
  lastAnsweredQuery: ClaimQuery | null;
  savedResponse: string;
  documents: RequirementRow[];
  isLender: boolean;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState(savedResponse);
  const [dirty, setDirty] = useState(false);

  const onSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveDraftAction(accountId, claimId, {
        __queryResponse: response,
      });
      if (!result.ok) {
        toast.error(result.error ?? "The response could not be saved.");
        return;
      }
      setDirty(false);
      toast.success("Response saved as draft.");
      router.refresh();
    });
  }, [accountId, claimId, response, router]);

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
      setDirty(false);
      toast.success("Response submitted — back with IMGC for review.");
      router.refresh();
    });
  }, [accountId, claimId, response, router]);

  if (!openQuery) {
    if (!lastAnsweredQuery) {
      return (
        <Panel
          title="Query Response"
          description="Only actionable while IMGC has an open query on this claim."
        >
          <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
            {noQueryMessage(claimStatus)}
          </p>
        </Panel>
      );
    }

    // ── Response Submitted — read-only recap ──────────────────────────
    const respondedDocs = documents.filter((d) =>
      lastAnsweredQuery.requestedDocuments.includes(d.name)
    );
    return (
      <Panel title="Query Response" description="Response submitted.">
        <div className="space-y-4 px-5 py-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-700">
            <CheckCircle2Icon className="size-4" />
            Response Submitted
          </p>
          <div>
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Response
            </span>
            <p className="rounded-lg border border-neutral-200 bg-neutral-25 px-3 py-2 text-[13px] text-neutral-700">
              {lastAnsweredQuery.responseRemarks || "—"}
            </p>
          </div>
          {respondedDocs.length > 0 && (
            <div>
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Supporting Documents
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {respondedDocs.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-700"
                  >
                    {d.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-neutral-500">
            Submitted on {lastAnsweredQuery.respondedAt ? when(lastAnsweredQuery.respondedAt) : "—"}
            {lastAnsweredQuery.respondedByName ? ` by ${lastAnsweredQuery.respondedByName}` : ""}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Query Response"
      description="Respond to the open query and provide any supporting documents."
    >
      <div className="space-y-4 px-5 py-4">
        {/* ── Query, read-only ────────────────────────────────── */}
        <div className="rounded-xl border border-warning/40 bg-warning/8 px-4 py-3.5">
          <header className="mb-2 flex items-center gap-2">
            <MessageSquareWarningIcon className="size-4 text-warning" />
            <h3 className="text-[13.5px] font-semibold text-neutral-950">
              Query raised
            </h3>
          </header>

          <dl className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Query ID
              </dt>
              <dd className="text-[12.5px] font-medium text-neutral-900">
                {displayQueryId(openQuery.id)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Raised By
              </dt>
              <dd className="text-[12.5px] font-medium text-neutral-900">
                {openQuery.raisedByName}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Raised Date
              </dt>
              <dd className="text-[12.5px] font-medium text-neutral-900">
                {when(openQuery.raisedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Due Date
              </dt>
              <dd className="text-[12.5px] font-medium text-neutral-900">
                {openQuery.dueDate ? when(openQuery.dueDate) : "—"}
              </dd>
            </div>
          </dl>

          <p className="text-[13px] text-neutral-800">{openQuery.reason}</p>
          {openQuery.remarks && (
            <p className="mt-1 text-[12.5px] text-neutral-600">{openQuery.remarks}</p>
          )}
          {openQuery.requestedDocuments.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {openQuery.requestedDocuments.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-800 ring-1 ring-warning/40"
                >
                  {name}
                </span>
              ))}
            </p>
          )}
        </div>

        {!isLender ? (
          <p className="rounded-lg bg-neutral-50 px-3.5 py-2.5 text-[12.5px] text-neutral-600">
            Awaiting the lender&apos;s response.
          </p>
        ) : (
          <>
            {/* ── Response ──────────────────────────────────────── */}
            <div>
              <label htmlFor="query-response" className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Response {response.trim() ? "" : "*"}
              </label>
              <textarea
                id="query-response"
                value={response}
                maxLength={RESPONSE_MAX}
                onChange={(e) => {
                  setResponse(e.target.value);
                  setDirty(true);
                }}
                rows={4}
                placeholder="Enter your response to the query..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-neutral-400">
                <span>Required before submitting.</span>
                <span>
                  {response.length}/{RESPONSE_MAX} characters
                </span>
              </div>
            </div>

            {/* ── Supporting documents — same upload machinery as the workspace ── */}
            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-neutral-700">
                Supporting Documents
              </span>
              <ClaimDocuments
                accountId={accountId}
                claimId={claimId}
                documents={documents}
                locked={false}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3.5">
              <Button variant="outline" size="sm" onClick={onSave} disabled={pending}>
                <SaveIcon /> Save Response
              </Button>
              <Button size="sm" onClick={onSubmit} disabled={pending}>
                <SendIcon /> Submit Response
              </Button>
            </div>
            {dirty && (
              <p className="text-right text-[11.5px] text-neutral-400">
                Unsaved changes — click Save Response to keep them.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
