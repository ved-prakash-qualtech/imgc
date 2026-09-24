/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop */
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  setClaimStatusAction,
  startClaimReviewAction,
} from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { markRefundReceivedAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { attachUpload } from "@/lib/uploads/attachUpload";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/constants/uploads";

import { AuditTrailTab } from "@/app/[locale]/(portal)/accounts/[accountId]/AuditTrailTab";
import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
// Named for the screen it was written for, but it takes only a history and a status — nothing in
// it is lender-specific, so IMGC's Query/Decision tab shows the identical bar.
import { LenderClaimStatusPanel as ClaimStatusBar } from "@/components/portal/LenderClaimStatusPanel";
import { ExportDocumentsCsvButton } from "@/components/portal/ExportDocumentsCsvButton";
import { ActionFooter } from "@/components/portal/ActionFooter";
import {
  buildClaimRemarkItems,
  ClaimRemarksPanel,
} from "@/components/portal/ClaimRemarksPanel";
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
import type { AuditEvent, Remark, Role, ClaimQuery } from "@/server/mock/types";

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
  /** Every remark on this account — filtered down to this claim's initiation remark inside
   *  `buildClaimRemarkItems`, so the Remarks panel can show its real date/time and author. */
  remarks: Remark[];

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
  remarks,

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
          claimRemarks={buildClaimRemarkItems(claim, remarks)}
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
  claimRemarks,
  claimDocs,
  documentsSection,
}: Readonly<{
  account: AccountRow;
  role: Role;
  claim: ClaimRow | null;
  claimRemarks: ReturnType<typeof buildClaimRemarkItems>;
  /** The same rows the document table shows, for its Export CSV. */
  claimDocs: DocumentRow[];
  documentsSection: React.ReactNode;
}>) {
  const [pending, startTransition] = useTransition();
  // Approve/Reject open a dialog for an optional note; both sides read it under Remarks.
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(
    null
  );
  const [note, setNote] = useState("");

  // "Refund Received" — its own small form (UTR + an optional proof file), not the note-only
  // Approve/Ineligible dialog above: recording money received is a different fact from deciding
  // the claim, so it gets its own state rather than overloading `deciding`/`note`.
  const [refundOpen, setRefundOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [refundFile, setRefundFile] = useState<File | null>(null);
  const [refundError, setRefundError] = useState("");

  const onPickRefundFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0] ?? null;
      setRefundError("");
      if (!picked) return setRefundFile(null);
      if (!(ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(picked.type)) {
        setRefundError("Only PDF, JPG, PNG or WEBP files are accepted.");
        return setRefundFile(null);
      }
      if (picked.size > MAX_UPLOAD_BYTES) {
        setRefundError(`That file is over the ${MAX_UPLOAD_LABEL} limit.`);
        return setRefundFile(null);
      }
      setRefundFile(picked);
    },
    []
  );

  const submitRefund = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!utr.trim()) {
        setRefundError("Enter the UTR / reference number.");
        return;
      }
      const amountNum = Number(amount);
      if (!amount.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
        setRefundError("Enter a valid amount.");
        return;
      }
      const data = new FormData(event.currentTarget);
      startTransition(async () => {
        if (refundFile) {
          try {
            await attachUpload(data, refundFile, account.id);
          } catch {
            toast.error("That upload failed. Please try again.");
            return;
          }
        }
        if (!claim) return;
        const result = await markRefundReceivedAction(claim.id, data);
        if (!result.ok) {
          toast.error(result.error ?? "That could not be recorded.");
          return;
        }
        toast.success("Refund received — recorded.");
        setRefundOpen(false);
        setUtr("");
        setAmount("");
        setRefundFile(null);
        setRefundError("");
      });
    },
    [utr, amount, refundFile, account.id, claim]
  );

  const decide = useCallback(
    (status: "APPROVED" | "REJECTED", decisionNote: string) => {
      startTransition(async () => {
        const result = await setClaimStatusAction(
          account.id,
          status,
          decisionNote
        );
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
  const requiredDocs = claimDocs.filter(
    (d) => d.required && d.active !== false
  );
  const allRequiredAccepted =
    requiredDocs.length > 0 &&
    requiredDocs.every((d) => d.status === "APPROVED");

  const claimDecided =
    isApproved || refundReceived || claim?.status === "REJECTED";

  // Submit for Review waits for every document, optional ones included, to be accepted.
  // An optional document nobody uploaded isn't on the table at all (it is hidden), so it can't
  // hold Submit for Review back — only what is shown has to be accepted.
  const activeDocs = claimDocs.filter(
    (d) => d.active !== false && !(!d.required && d.status === "PENDING_UPLOAD")
  );
  const allDocsAccepted =
    allRequiredAccepted &&
    activeDocs.every((d) => d.status === "APPROVED" || d.status === "WAIVED");

  const footerHasActions =
    (claim?.status === "INITIATED" && allDocsAccepted) ||
    claim?.status === "UNDER_REVIEW" ||
    (isApproved && !refundReceived) ||
    Boolean(
      claim &&
      !claimDecided &&
      claim.status !== "QUERY_INITIATED" &&
      claim.status !== "QUERY_UNDER_REVIEW"
    );

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
            Ineligible
          </Button>
        )}
        {isApproved && !refundReceived && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefundOpen(true)}
            disabled={pending}
          >
            Refund Received
          </Button>
        )}
        {claim &&
          !claimDecided &&
          claim.status !== "QUERY_INITIATED" &&
          claim.status !== "QUERY_UNDER_REVIEW" && (
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
          lender={claimRemarks.lender}
          imgc={claimRemarks.imgc}
          decision={claimRemarks.decision}
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
              {deciding === "APPROVED" ? "Mark approved" : "Mark ineligible"}
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
              {deciding === "APPROVED" ? "Approve" : "Ineligible"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setRefundOpen(false);
            setUtr("");
            setAmount("");
            setRefundFile(null);
            setRefundError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund received</DialogTitle>
            <DialogDescription>
              Record the payment date, UTR / reference number and amount
              received against this claim. A proof file is optional — all of it
              is visible to the lender once saved.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRefund} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Payment date *
              </span>
              <input
                type="date"
                name="paymentDate"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                UTR / reference number *
              </span>
              <input
                name="utr"
                required
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. UTR2026090112345"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Amount received (₹) *
              </span>
              {/* Free entry from the IMGC team — not checked against the computed claim amount,
                  since a genuine partial settlement is a real case here, not an error. */}
              <input
                type="number"
                name="amount"
                required
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500000"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Proof of payment (optional)
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={onPickRefundFile}
                className="block w-full text-[12.5px] text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-[12px] file:font-medium hover:file:bg-neutral-200"
              />
              {refundFile && (
                <p className="mt-1 text-[11.5px] text-neutral-500">
                  {refundFile.name}
                </p>
              )}
            </label>
            {refundError && (
              <p
                role="alert"
                className="text-[12px] font-medium text-destructive"
              >
                {refundError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefundOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
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
