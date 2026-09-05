"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareWarningIcon, SaveIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import {
  saveDraftAction,
  submitClaimAction,
} from "@/app/[locale]/(portal)/initiate-claim/actions";
import { ClaimDocuments } from "@/components/portal/ClaimDocuments";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { ClaimQuery } from "@/server/mock/types";

const RESPONSE_MAX = 2000;

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  openQuery,
  savedResponse,
  documents,
  isLender,
}: Readonly<{
  accountId: string;
  claimId: string;
  openQuery: ClaimQuery | null;
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
    return (
      <Panel
        title="Query Response"
        description="Only actionable while IMGC has an open query on this claim."
      >
        <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
          No active query. Answered queries appear in Queries below.
        </p>
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
          <header className="mb-2 flex flex-wrap items-center gap-2">
            <MessageSquareWarningIcon className="size-4 text-warning" />
            <h3 className="text-[13.5px] font-semibold text-neutral-950">
              Query raised
            </h3>
            <span className="text-[11.5px] text-neutral-600">
              {openQuery.raisedByName} · {when(openQuery.raisedAt)}
            </span>
          </header>
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
                Your Response {response.trim() ? "" : "*"}
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
                placeholder="Enter your response..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-neutral-400">
                <span>Required before submitting.</span>
                <span>
                  {response.length}/{RESPONSE_MAX}
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
