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
import { ExportDocumentsCsvButton } from "@/components/portal/ExportDocumentsCsvButton";
import { ActionFooter } from "@/components/portal/ActionFooter";
import { ClaimRemarksPanel } from "@/components/portal/ClaimRemarksPanel";
import { Panel } from "@/components/portal/Panel";
import { QueriedButton } from "@/components/portal/QueriedButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
          claimDocs={claimDocs}
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
  claimDocs,
  documentsSection,
}: Readonly<{
  account: AccountRow;
  role: Role;
  claim: ClaimRow | null;
  /** The same rows the document table shows, for its Export CSV. */
  claimDocs: DocumentRow[];
  documentsSection: React.ReactNode;
}>) {
  const [pending, startTransition] = useTransition();
  // Approve/Reject open a dialog for an optional note; both sides read it under Remarks.
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [note, setNote] = useState("");

  const decide = useCallback(
    (status: "APPROVED" | "REJECTED", decisionNote: string) => {
      startTransition(async () => {
        const result = await setClaimStatusAction(account.id, status, decisionNote);
        if (!result.ok) {
          toast.error(result.error ?? "That status could not be set.");
          return;
        }
        setDeciding(null);
        setNote("");
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
  // Review can only start once every required document is accepted — the service refuses it
  // otherwise, so the button waits for the same condition instead of offering a click that fails.
  const requiredDocs = claimDocs.filter((d) => d.required && d.active !== false);
  const allRequiredAccepted =
    requiredDocs.length > 0 && requiredDocs.every((d) => d.status === "APPROVED");

  // Queried is only for a document still waiting on IMGC or one IMGC turned down — and never
  // once the claim itself is decided.
  const hasOpenDocs = claimDocs.some(
    (d) =>
      d.active !== false &&
      ["PENDING_UPLOAD", "UNDER_REVIEW", "REJECTED", "REUPLOAD_REQUIRED"].includes(d.status)
  );
  const claimDecided =
    isApproved || refundReceived || claim?.status === "REJECTED";

  // Submit for Review waits for every document, optional ones included, to be accepted.
  const activeDocs = claimDocs.filter((d) => d.active !== false);
  const allDocsAccepted =
    allRequiredAccepted && activeDocs.every((d) => d.status === "APPROVED");

  const footerHasActions =
    (claim?.status === "INITIATED" && allDocsAccepted) ||
    claim?.status === "UNDER_REVIEW" ||
    Boolean(claim && !claimDecided && hasOpenDocs);

  const imgcComposer = (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {claim?.status === "INITIATED" && allDocsAccepted && (
          <Button
            size="sm"
            onClick={() => {
              startTransition(async () => {
                const result = await startClaimReviewAction(account.id, "");
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
            onClick={() => setDeciding("APPROVED")}
            disabled={pending}
          >
            Mark approved
          </Button>
        )}
        {claim?.status === "UNDER_REVIEW" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeciding("REJECTED")}
            disabled={pending}
          >
            Reject
          </Button>
        )}
        {claim && !claimDecided && hasOpenDocs && (
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
          action={
            <ExportDocumentsCsvButton
              docs={claimDocs}
              fileName={`${claim.claimNo || account.loanNo}-documents.csv`}
            />
          }
        />
      )}

      {documentsSection}

      {claim && (
        <ClaimRemarksPanel
          lender={claim.fields.__initiationRemark}
          imgc={claim.fields.__imgcReviewRemark}
          decision={claim.fields.__imgcDecisionRemark}
        />
      )}

      {/* No actions on offer means no bar, rather than an empty one. */}
      {footerHasActions && (
        <ActionFooter className="mt-4">{imgcComposer}</ActionFooter>
      )}

      <Dialog
        open={deciding !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeciding(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding === "APPROVED" ? "Mark approved" : "Reject claim"}
            </DialogTitle>
            <DialogDescription>
              A note is required. The lender sees it under Remarks.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (required)"
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeciding(null);
                setNote("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={deciding === "APPROVED" ? "success" : "destructive"}
              onClick={() => {
                if (!note.trim()) {
                  toast.error("Add a note before you continue.");
                  return;
                }
                if (deciding) decide(deciding, note.trim());
              }}
              disabled={pending}
            >
              {deciding === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
