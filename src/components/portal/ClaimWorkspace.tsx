/* eslint-disable @typescript-eslint/no-unused-vars, security/detect-object-injection, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop */
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  MessageSquareWarningIcon,
  SaveIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  saveDraftAction,
  submitClaimAction,
  switchClaimTypeAction,
} from "@/app/[locale]/(portal)/initiate-claim/actions";
import { ClaimDocuments } from "@/components/portal/ClaimDocuments";

import { LoanDetailsCard } from "@/components/portal/LoanDetailsCard";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  claimConfig,
  CLAIM_TYPE_KEYS,
  CLAIM_TYPES,
  fieldVisible,
} from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AccountRow } from "@/services/portal/accounts.server";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type {
  ClaimQuery,
  ClaimStatus,
  ClaimTypeKey,
} from "@/server/mock/types";

type WorkspaceTab = "loan-details" | "initiate-claim";

/** A required document is still outstanding until it is with IMGC or approved. */
function outstanding(doc: RequirementRow): boolean {
  return doc.status !== "UNDER_REVIEW" && doc.status !== "APPROVED";
}

/**
 * The lender's claim-initiation workspace: read-only loan details, then the document work.
 *
 * There is no data-entry form — loan information comes from the account, the checklist comes
 * from the claim type's configuration, and submission is gated only on the applicable mandatory
 * documents being uploaded.
 */
export function ClaimWorkspace({
  account,
  accountId,
  claimId,
  claimNo,
  claimType,
  status,
  fields,
  documents,
  openQuery,
  backHref,
}: Readonly<{
  account: AccountRow;
  accountId: string;
  claimId: string;
  claimNo: string;
  claimType: ClaimTypeKey;
  status: ClaimStatus;
  fields: Record<string, string>;
  documents: RequirementRow[];
  openQuery: ClaimQuery | null;
  backHref: string;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(fields);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("initiate-claim");

  const config = claimConfig(claimType);
  const onFieldChange = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const missingFieldLabels = useMemo(
    () =>
      config.fields
        .filter(
          (f) => f.required && fieldVisible(f, values) && !values[f.id]?.trim()
        )
        .map((f) => f.label),
    [config.fields, values]
  );

  const missingDocs = useMemo(
    () =>
      documents
        .filter(
          (d) =>
            d.addedBy !== "LENDER" && d.required && d.active && outstanding(d)
        )
        .map((d) => d.name),
    [documents]
  );
  const canSubmit = missingDocs.length === 0 && missingFieldLabels.length === 0;

  const resubmitting = status === "QUERY_RAISED";
  const locked =
    status === "APPROVED" || status === "REJECTED" || status === "CLOSED";

  const onSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveDraftAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(result.error ?? "That could not be saved.");
        return;
      }
      toast.success("Claim saved.");
      router.refresh();
    });
  }, [accountId, claimId, router, values]);

  const onSubmit = useCallback(() => {
    startTransition(async () => {
      const result = await submitClaimAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(result.error ?? "That claim could not be submitted.");
        return;
      }
      toast.success(
        resubmitting
          ? `${claimNo} resubmitted — back with IMGC for review.`
          : `${claimNo} submitted to IMGC.`
      );
      // Away from the workspace, not a refresh-in-place: the claim is now with IMGC, so there is
      // nothing left to do here until a query brings it back. Re-opening it (Continue/Track) picks
      // up wherever it actually stands, rather than leaving this same Save & Submit bar sitting on
      // screen looking clickable right after a successful submission.
      // Return to the grid sorted by Last Updated descending so the newly submitted
      // claim (lastUpdatedAt = now) appears at the top of page 1 immediately.
      const backWithSort = backHref.includes("?")
        ? `${backHref}&sort=lastUpdatedAt_desc`
        : `${backHref}?sort=lastUpdatedAt_desc`;
      router.push(backWithSort);
    });
  }, [accountId, backHref, claimId, claimNo, resubmitting, router, values]);

  const onChangeType = useCallback(
    (next: ClaimTypeKey) => {
      if (next === claimType) return;
      startTransition(async () => {
        const result = await switchClaimTypeAction(accountId, claimId, next);
        if (!result.ok) {
          toast.error(result.error ?? "The claim type could not be changed.");
          return;
        }
        toast.success(`Switched to ${CLAIM_TYPES[next].label}.`);
        router.refresh();
      });
    },
    [claimType, accountId, claimId, router]
  );

  const onCancel = useCallback(() => {
    router.push(backHref);
  }, [backHref, router]);

  return (
    <div className="space-y-2">
      {openQuery && <QueryBanner query={openQuery} />}

      {/* ── Tab bar row: Back link + tab pills on one line ───── */}
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeftIcon className="size-3" /> Back
        </Link>
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
          {(["loan-details", "initiate-claim"] as WorkspaceTab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors",
                activeTab === id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {id === "loan-details" ? "Loan Details" : "Initiate Claim"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loan Details tab ────────────────────────────────── */}
      {activeTab === "loan-details" && <LoanDetailsCard account={account} />}

      {/* ── Initiate Claim tab — 2-column, viewport-fit ─────── */}
      {activeTab === "initiate-claim" && (
        <div
          className="flex gap-3 overflow-hidden"
          style={{ height: "calc(100vh - 8.5rem)" }}
        >
          {/* ── LEFT: Claim Type (fixed width, self-contained) ── */}
          <div className="w-72 shrink-0">
            <Panel
              title="Claim type"
              description="Determines which documents are required."
              actions={<StatusPill status={status} />}
            >
              <div className="flex flex-col gap-2 px-4 py-3">
                {CLAIM_TYPE_KEYS.map((key) => {
                  const t = CLAIM_TYPES[key];
                  const active = key === claimType;
                  const isLocked = key === "SUBSEQUENT";
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={status !== "DRAFT" || pending || isLocked}
                      aria-pressed={active}
                      onClick={() => onChangeType(key)}
                      className={cn(
                        "w-full rounded-lg border-2 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                        active
                          ? "border-brand-primary bg-brand-light/50"
                          : "border-neutral-200 hover:border-brand-primary/40 hover:bg-neutral-50"
                      )}
                    >
                      <span className="block text-[12.5px] font-semibold text-neutral-900">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-neutral-500">
                        {t.documents.filter((d) => d.required).length} required
                        docs
                      </span>
                    </button>
                  );
                })}
                {status !== "DRAFT" && (
                  <p className="pt-1 text-[11px] text-neutral-400">
                    The claim type is fixed once the claim leaves draft.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          {/* ── RIGHT: Documents + action bar (scrollable internally) ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            {/* Scrollable document area */}
            <div className="flex-1 overflow-y-auto pr-0.5">
              <ClaimDocuments
                accountId={accountId}
                claimId={claimId}
                documents={documents}
                locked={locked}
              />
            </div>

            {/* Pinned action bar */}
            {!locked && (
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-white px-5 py-2.5 shadow-sm">
                <div className="min-w-0 text-[12.5px]">
                  {canSubmit && (
                    <p className="flex items-center gap-1.5 font-medium text-success-700">
                      <CheckCircle2Icon className="size-4" />
                      Every mandatory document is in — you can{" "}
                      {resubmitting ? "resubmit" : "submit"} this claim.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={pending}
                  >
                    <XIcon /> Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSave}
                    disabled={pending}
                  >
                    <SaveIcon /> Save
                  </Button>
                  <Button
                    size="sm"
                    onClick={onSubmit}
                    disabled={pending || !canSubmit}
                    title={
                      canSubmit
                        ? undefined
                        : "Upload the outstanding mandatory documents first."
                    }
                  >
                    <SendIcon />{" "}
                    {resubmitting ? "Save & Resubmit" : "Save & Submit"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** What IMGC asked for, and what the lender has to do about it. */
function QueryBanner({ query }: Readonly<{ query: ClaimQuery }>) {
  return (
    <section className="rounded-xl border border-warning/40 bg-warning/8 px-5 py-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <MessageSquareWarningIcon className="size-4 text-warning" />
        <h2 className="text-[14px] font-semibold text-neutral-950">
          Query raised
        </h2>
        <span className="text-[12px] text-neutral-600">
          by {query.raisedByName} ·{" "}
          {new Date(query.raisedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </header>

      <dl className="space-y-1.5 text-[13px]">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-neutral-700">Reason:</dt>
          <dd className="text-neutral-800">{query.reason}</dd>
        </div>
        {query.remarks && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              Remarks:
            </dt>
            <dd className="text-neutral-700">{query.remarks}</dd>
          </div>
        )}
        {query.requestedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              Required action:
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {query.requestedDocuments.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-800 ring-1 ring-warning/40"
                >
                  Upload {name}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
