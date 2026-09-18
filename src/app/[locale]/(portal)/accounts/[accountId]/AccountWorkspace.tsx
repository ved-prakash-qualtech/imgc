/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop */
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  setClaimStatusAction,
  startClaimReviewAction,
} from "@/app/[locale]/(portal)/accounts/[accountId]/actions";

import { AuditTrailTab } from "@/app/[locale]/(portal)/accounts/[accountId]/AuditTrailTab";
import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
// Named for the screen it was written for, but it takes only a history and a status — nothing in
// it is lender-specific, so IMGC's Query/Decision tab shows the identical bar.
import { LenderClaimStatusPanel as ClaimStatusBar } from "@/components/portal/LenderClaimStatusPanel";
import { Panel } from "@/components/portal/Panel";
import { QueriedButton } from "@/components/portal/QueriedButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AccountRow } from "@/services/portal/accounts.server";
import type { DocumentRow } from "@/services/portal/claims.server";
import type { ClaimRow } from "@/services/portal/claimFlow.server";
import type { AuditEvent, Role, ClaimQuery } from "@/server/mock/types";

const TABS = ["Loan Details", "Decision", "Audit Trail"] as const;

/** URL-friendly slugs for `?tab=` — a notification linking into an account picks the tab that
 *  actually shows what it's about (see notifications/page.tsx's `tabSlugForEvent`). */
const TAB_SLUGS: Record<(typeof TABS)[number], string> = {
  "Loan Details": "overview",
  Decision: "query-trail",
  "Audit Trail": "audit-trail",
};

function tabFromSlug(slug: string | null, role: Role): (typeof TABS)[number] {
  if (slug === "initial-claims") return "Decision";
  return (
    // eslint-disable-next-line security/detect-object-injection
    TABS.find((t) => TAB_SLUGS[t] === slug) ??
    (role === "IMGC" ? "Decision" : "Loan Details")
  );
}

export type OpenQuery = ClaimQuery & { overdue: boolean };

type Props = Readonly<{
  account: AccountRow;
  role: Role;
  docs: DocumentRow[];
  events: AuditEvent[];
  claim: ClaimRow | null;

  canSubmit: boolean;
  retentionDays: number;
  /** Names of documents an open query already covers — so a rejection from before that sync
   *  existed can offer to raise one, and a fresh rejection (already covered) doesn't. */
  queriedDocNames: string[];
  openQueries: OpenQuery[];
  backLink?: React.ReactNode;
}>;

export function AccountWorkspace({
  account,
  role,
  docs,
  events,
  claim,

  canSubmit,
  retentionDays,
  queriedDocNames,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openQueries,
  backLink,
}: Props) {
  // A notification deep-links here with `?tab=initial-claims` etc. — land on that tab instead of
  // always defaulting to Loan Details. Read once; switching tabs afterwards stays plain local state.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(() =>
    tabFromSlug(searchParams.get("tab"), role)
  );

  // The canonical document checklist for the active claim.
  const claimDocs = useMemo(() => {
    if (!claim) return [];
    return docs.filter((d) => d.claimId === claim.id);
  }, [docs, claim]);

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap items-center gap-1 border-b border-neutral-200"
        role="tablist"
        aria-label="Account sections"
      >
        {backLink && <div className="mr-4 flex items-center">{backLink}</div>}
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
          </button>
        ))}
      </div>

      {tab === "Loan Details" && <OverviewTab account={account} />}

      {tab === "Decision" && (
        <QueryTrailTab
          account={account}
          role={role}
          claim={claim}
          documentsSection={
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
          }
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
  documentsSection,
}: Readonly<{
  account: AccountRow;
  role: Role;
  claim: ClaimRow | null;
  documentsSection: React.ReactNode;
}>) {
  const [pending, startTransition] = useTransition();

  const decide = useCallback(
    (status: "APPROVED" | "QUERIED" | "REJECTED") => {
      startTransition(async () => {
        const result = await setClaimStatusAction(account.id, status, "");
        if (!result.ok) {
          toast.error(result.error ?? "That status could not be set.");
          return;
        }
        toast.success(`Claim marked ${status.toLowerCase()}.`);
      });
    },
    [account.id]
  );

  if (role !== "IMGC") return null;

  // "Mark approved" only makes sense before a decision exists — once the claim is approved, its
  // slot in this row is taken over by "Refund Received" (a further confirmation on the same
  // approval, not a second decision), which in turn gives way to a plain confirmation pill once
  // that's recorded. "Raise a query" stays put throughout, only going dead once the refund is in
  // and there is nothing left to query.
  const isApproved = claim?.status === "APPROVED";
  const refundReceived = claim?.status === "REFUND_RECEIVED_BY_IMGC";

  const imgcComposer = (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      <div className="flex flex-wrap items-end gap-1">
        {claim?.status === "INITIATED" && (
          <Button
            size="sm"
            onClick={() => {
              startTransition(async () => {
                const result = await startClaimReviewAction(account.id);
                if (!result.ok) {
                  toast.error(
                    result.error ?? "The claim review could not be started."
                  );
                  return;
                }
                toast.success("Review started.");
              });
            }}
            disabled={pending}
          >
            Submit for Review
          </Button>
        )}
        {claim?.status === "UNDER_REVIEW" && !isApproved && !refundReceived && (
          <Button
            size="sm"
            variant="success"
            onClick={() => decide("APPROVED")}
            disabled={pending}
          >
            Mark approved
          </Button>
        )}
        {claim?.status === "UNDER_REVIEW" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => decide("REJECTED")}
            disabled={pending}
          >
            Reject
          </Button>
        )}
        {claim && !refundReceived && (
          <QueriedButton claimId={claim.id} claimNo={claim.claimNo} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* The same status bar the lender reads on Track Claim — IMGC decides on this tab, so where
          the claim currently stands belongs on it too, rather than only on the claim detail page. */}
      {claim && (
        <ClaimStatusBar
          history={claim.statusHistory}
          currentStatus={claim.status}
        />
      )}

      {documentsSection}

      <div className="sticky bottom-0 z-20 mt-4 pt-2">{imgcComposer}</div>
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────── */

import { LoanDetailsCard } from "@/components/portal/LoanDetailsCard";

function OverviewTab({
  account,
}: Readonly<{
  account: AccountRow;
}>) {
  return (
    <div className="space-y-4">
      <LoanDetailsCard account={account} />

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
