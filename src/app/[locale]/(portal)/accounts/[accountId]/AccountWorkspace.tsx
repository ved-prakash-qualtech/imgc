/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop */
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { setClaimStatusAction } from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { markRefundReceivedAction } from "@/app/[locale]/(portal)/initiate-claim/actions";

import { AuditTrailTab } from "@/app/[locale]/(portal)/accounts/[accountId]/AuditTrailTab";
import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
import { Panel } from "@/components/portal/Panel";
import { QueryResponseSection } from "@/components/portal/QueryResponseSection";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AccountRow } from "@/services/portal/accounts.server";
import type { DocumentRow } from "@/services/portal/claims.server";
import type { ClaimRow } from "@/services/portal/claimFlow.server";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { AuditEvent, ClaimQuery, Remark, Role } from "@/server/mock/types";

const TABS = [
  "Loan Details",
  "Query/Decision",
  "Documents",
  "Audit Trail",
] as const;

/** URL-friendly slugs for `?tab=` — a notification linking into an account picks the tab that
 *  actually shows what it's about (see notifications/page.tsx's `tabSlugForEvent`). */
const TAB_SLUGS: Record<(typeof TABS)[number], string> = {
  "Loan Details": "overview",
  "Query/Decision": "query-trail",
  Documents: "initial-claims",
  "Audit Trail": "audit-trail",
};

function tabFromSlug(slug: string | null): (typeof TABS)[number] {
  return TABS.find((t) => TAB_SLUGS[t] === slug) ?? "Loan Details";
}

type Props = Readonly<{
  account: AccountRow;
  role: Role;
  docs: DocumentRow[];
  events: AuditEvent[];
  claim: ClaimRow | null;
  queries: ClaimQuery[];
  remarks: Remark[];
  claimDocuments: RequirementRow[];
  canSubmit: boolean;
  retentionDays: number;
  /** Names of documents an open query already covers — so a rejection from before that sync
   *  existed can offer to raise one, and a fresh rejection (already covered) doesn't. */
  queriedDocNames: string[];
}>;

export function AccountWorkspace({
  account,
  role,
  docs,
  events,
  claim,
  queries,
  remarks,
  claimDocuments,
  canSubmit,
  retentionDays,
  queriedDocNames,
}: Props) {
  // A notification deep-links here with `?tab=initial-claims` etc. — land on that tab instead of
  // always defaulting to Loan Details. Read once; switching tabs afterwards stays plain local state.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(() =>
    tabFromSlug(searchParams.get("tab"))
  );

  // The canonical document checklist for the active claim.
  const claimDocs = useMemo(() => {
    if (!claim) return [];
    return docs.filter((d) => d.claimId === claim.id);
  }, [docs, claim]);

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200"
        role="tablist"
        aria-label="Account sections"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              tab === name
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {name}
            {name === "Documents" && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
                  claimDocs.filter(
                    (d) => d.required && d.status === "PENDING_UPLOAD"
                  ).length > 0
                    ? "bg-warning/15 text-warning"
                    : "bg-success/15 text-success-700"
                )}
              >
                {
                  claimDocs.filter(
                    (d) =>
                      d.status === "UNDER_REVIEW" || d.status === "APPROVED"
                  ).length
                }
                /{claimDocs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Loan Details" && <OverviewTab account={account} />}

      {tab === "Query/Decision" && (
        <QueryTrailTab
          account={account}
          role={role}
          claim={claim}
          queries={queries}
          remarks={remarks}
          claimDocuments={claimDocuments}
        />
      )}

      {tab === "Documents" && (
        <InitialClaimsTab
          accountId={account.id}
          accountProduct={account.product}
          role={role}
          docs={claimDocs}
          claimStatus={account.claimStatus}
          canSubmit={canSubmit}
          retentionDays={retentionDays}
          queriedDocNames={queriedDocNames}
        />
      )}
      {tab === "Audit Trail" && <AuditTrailTab events={events} />}
    </div>
  );
}

function QueryTrailTab({
  account,
  role,
  claim,
  queries,
  remarks,
  claimDocuments,
}: Readonly<{
  account: AccountRow;
  role: Role;
  claim: ClaimRow | null;
  queries: ClaimQuery[];
  remarks: Remark[];
  claimDocuments: RequirementRow[];
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  // Its own transition, separate from the note composer's — clicking "Refund Received" doesn't
  // need a note and shouldn't wait on (or be blocked by) whatever the Approve/Query composer is
  // doing, and vice versa.
  const [refundPending, startRefundTransition] = useTransition();

  const decide = useCallback(
    (status: "APPROVED" | "QUERIED" | "REJECTED") => {
      const trimmedNote = note.trim();
      if (!trimmedNote) {
        setNoteError(
          status === "APPROVED"
            ? "Please enter a note before marking the case as approved."
            : status === "REJECTED"
            ? "Please enter a note before rejecting the case."
            : "Please enter a note before raising a query."
        );
        return;
      }

      startTransition(async () => {
        const result = await setClaimStatusAction(account.id, status, note);
        if (!result.ok) {
          toast.error(result.error ?? "That status could not be set.");
          return;
        }
        setNote("");
        setNoteError("");
        toast.success(`Claim marked ${status.toLowerCase()}.`);
        router.refresh();
      });
    },
    [account.id, note, router]
  );

  const markRefund = useCallback(() => {
    if (!claim) return;
    startRefundTransition(async () => {
      const result = await markRefundReceivedAction(claim.id);
      if (!result.ok) {
        toast.error(result.error ?? "The refund could not be recorded.");
        return;
      }
      toast.success("Refund marked as received by IMGC.");
      router.refresh();
    });
  }, [claim, router]);

  if (role !== "IMGC") return null;

  const imgcComposer = (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      <div className="flex flex-wrap items-end gap-1">
        <label className="min-w-[280px] flex-1">
          <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
            Note <span className="text-red-500">*</span>
          </span>
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError) setNoteError("");
            }}
            placeholder="e.g. Valuation clarified with the lender on call"
            className={`h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-colors ${
              noteError
                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                : "border-neutral-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            }`}
          />
        </label>
        <Button
          size="sm"
          variant="success"
          onClick={() => decide("APPROVED")}
          disabled={pending}
        >
          Mark approved
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => decide("REJECTED")}
          disabled={pending}
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => decide("QUERIED")}
          disabled={pending}
        >
          Raise a query
        </Button>
      </div>
      {noteError && (
        <p className="text-[12.5px] font-medium text-red-500">{noteError}</p>
      )}
      {/* Refund Received — only once the claim is actually approved, and only until it's been
          recorded once. Hidden the rest of the time, per the requirement, rather than shown
          disabled with no context for why. */}
      {claim?.status === "APPROVED" && (
        <div className="mt-1 flex items-center gap-2 border-t border-neutral-100 pt-1.5">
          <Button
            size="sm"
            variant="default"
            onClick={markRefund}
            disabled={refundPending}
          >
            Refund Received
          </Button>
          <span className="text-[11.5px] text-neutral-500">
            Confirms the refund for this claim has reached IMGC.
          </span>
        </div>
      )}
      {claim?.status === "REFUND_RECEIVED_BY_IMGC" && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-neutral-100 pt-1.5">
          <StatusPill status="REFUND_RECEIVED_BY_IMGC" />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[min(620px,calc(100vh-14rem))] min-h-[420px] min-w-0">
      {claim ? (
        <QueryResponseSection
          accountId={account.id}
          claimId={claim.id}
          claimStatus={claim.status}
          openQuery={claim.openQuery ?? null}
          queries={queries}
          claimRemarks={remarks.filter(
            (remark) => remark.source === "CLAIM_INITIATION"
          )}
          savedResponse={claim.fields.__queryResponse ?? ""}
          documents={claimDocuments}
          isLender={false}
          imgcComposer={imgcComposer}
          title="Query/Decision"
          constrainedLayout
        />
      ) : (
        <Panel
          title="Processing outcome"
          className="flex h-full min-h-0 flex-col overflow-hidden"
        >
          <div className="shrink-0">{imgcComposer}</div>
        </Panel>
      )}
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────── */

function Fact({
  label,
  value,
}: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-[13.5px] font-medium text-neutral-900">{value}</p>
    </div>
  );
}

function OverviewTab({
  account,
}: Readonly<{
  account: AccountRow;
}>) {
  return (
    <div className="space-y-4">
      <Panel title="Account">
        <div className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <Fact label="Loan number" value={account.loanNo} />
          <Fact label="Borrower" value={account.borrowerName} />
          <Fact label="Lender" value={account.lenderOrgName} />
          <Fact label="Product" value={account.product} />
          <Fact
            label="Processing bucket"
            value={<StatusPill status={account.bucket} />}
          />
          <Fact
            label="Claim status"
            value={<StatusPill status={account.claimStatus} />}
          />
          <Fact label="Stage" value={account.stage} />
          <Fact
            label="Documents in"
            value={`${account.requiredDocs - account.pendingDocs} of ${account.requiredDocs} mandatory`}
          />
        </div>
      </Panel>

      {account.pushRecipients.length > 0 && (
        <Panel title="Notification recipients">
          <p className="px-5 py-4 text-[13px] text-neutral-600">
            {account.pushRecipients.join(", ")}
          </p>
        </Panel>
      )}
    </div>
  );
}
