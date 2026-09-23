/* eslint-disable react-perf/jsx-no-jsx-as-prop */
import { claimAmountFor } from "@/config/claimConfig";
import { EyeIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { ClaimDetailSinglePage } from "@/components/portal/ClaimDetailSinglePage";
import { ClaimDetailTabs } from "@/components/portal/ClaimDetailTabs";
import { ClaimDocumentsTable } from "@/components/portal/ClaimDocumentsTable";
import { ClaimHistory } from "@/components/portal/ClaimHistory";
import { ClaimStatusHistoryGraph } from "@/components/portal/ClaimStatusHistoryGraph";
import { LenderClaimStatusPanel } from "@/components/portal/LenderClaimStatusPanel";
import { LoanDetailsCard } from "@/components/portal/LoanDetailsCard";
import { Panel } from "@/components/portal/Panel";
import { ActionFooter } from "@/components/portal/ActionFooter";
import {
  buildClaimRemarkItems,
  ClaimRemarksPanel,
} from "@/components/portal/ClaimRemarksPanel";
import { GridBackLink } from "@/components/portal/GridBackLink";
import { PortalShell } from "@/components/portal/PortalShell";
import { LiveClaimAgeing } from "@/components/portal/LiveClaimAgeing";
import { QueriedButton } from "@/components/portal/QueriedButton";
import { ResubmitClaimButton } from "@/components/portal/ResubmitClaimButton";
import { StatusPill } from "@/components/portal/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { CLAIMS_FILTER_KEY } from "@/lib/hooks/useRememberedFilters";
import { getAccount } from "@/services/portal/accounts.server";
import { getClaim, listQueries } from "@/services/portal/claimFlow.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";
import { listRemarks } from "@/services/portal/remarks.server";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A plain date, no time — for `refundReceipt.paymentDate` (a date IMGC entered, e.g. from a
 *  bulk upload), as opposed to `when()`'s timestamp for when something happened in the portal. */
function whenDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Track Claim / Claim Details — the same page for both roles, scoped by the service. */
export default async function ClaimDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ claimId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { claimId } = await params;
  const { view } = await searchParams;
  const isSingleView = view === "single";
  const session = await requireSession();

  const claim = await getClaim(session, claimId);
  if (!claim) notFound();

  const [documents, queries, account, remarks] = await Promise.all([
    listClaimDocuments(session, claim.id),
    listQueries(claim.id),
    getAccount(session, claim.accountId),
    listRemarks(claim.accountId),
  ]);
  const claimRemarks = buildClaimRemarkItems(claim, remarks);
  const isLender = session.role === "LENDER";

  // Answering a formal query is one way back to IMGC. The other is a rejection the lender has
  // already fixed: IMGC can reject a file without raising a query (the claim stays where it is),
  // and the replacement then sits there with no way to hand it back. A document counts as fixed
  // once its rejected file has been superseded and the replacement is awaiting a decision.
  //
  // Every submission and resubmission pushes a status entry, so a replacement uploaded after the
  // latest one has not been handed across yet — which is what stops the button from staying on
  // screen, invitingly clickable, once the lender has already sent the fix.
  const lastHandBackAt = claim.statusHistory.reduce(
    (latest, h) => (h.at > latest ? h.at : latest),
    ""
  );
  const fixedRejection = documents.some(
    (d) =>
      d.status === "UNDER_REVIEW" &&
      d.history.some(
        (f) => f.supersededAt && f.review?.decision === "REJECTED"
      ) &&
      d.files.some((f) => !f.review && f.uploadedAt > lastHandBackAt)
  );
  // A document still standing rejected has to be corrected first — `checkSubmittable` refuses the
  // submission while one is outstanding, so the button stays away rather than erroring on click.
  const rejectionOutstanding = documents.some(
    (d) => d.required && d.active && d.status === "REJECTED"
  );
  const inQuery =
    claim.status === "QUERY_INITIATED" || claim.status === "QUERY_UNDER_REVIEW";
  const canResubmit = inQuery || (fixedRejection && !rejectionOutstanding);
  // Deleting an uploaded file is a draft-only act: after the lender submits, the file is part of
  // what IMGC is reviewing. A wrong file is corrected by re-uploading over it, which keeps the
  // superseded copy in the audit trail, rather than by making it disappear.
  const canDeleteFiles = claim.status === "DRAFT";
  const terminal =
    claim.status === "APPROVED" ||
    claim.status === "REJECTED" ||
    claim.status === "CLOSED" ||
    claim.status === "REFUND_RECEIVED_BY_IMGC";
  // The confirmation IMGC recorded via "Refund Received" — read straight off the claim's own
  // history rather than a second field, so there is exactly one place this can ever disagree
  // with itself. Both roles land on this page (see the file doc comment), so this is how the
  // lender sees it too.
  const refundReceivedEntry =
    claim.status === "REFUND_RECEIVED_BY_IMGC"
      ? [...claim.statusHistory]
          .reverse()
          .find((h) => h.status === "REFUND_RECEIVED_BY_IMGC")
      : undefined;

  const layoutContent = isSingleView ? (
    <ClaimDetailSinglePage
      isLender={isLender}
      showSectionNav={isLender}
      loanDetails={account ? <LoanDetailsCard account={account} /> : null}
      backLink={
        <div className="flex items-center gap-3">
          {isLender && (
            // Back to the claims grid as the lender left it - a tile's filter (e.g. Initiated)
            // survives the round trip into a claim and out again.
            <GridBackLink
              href={ROUTES.initiateClaim}
              storageKey={CLAIMS_FILTER_KEY}
              label="Back"
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            />
          )}
          {!terminal && !isLender && (
            <QueriedButton claimId={claim.id} claimNo={claim.claimNo} />
          )}
        </div>
      }
      statusAndQuery={
        <>
          {isLender ? (
            <LenderClaimStatusPanel
              key="claim-status"
              history={claim.statusHistory}
              currentStatus={claim.status}
            />
          ) : (
            <Panel key="claim-status" title="Claim Status" className="shrink-0">
              <div className="px-5 py-4">
                <ClaimStatusHistoryGraph
                  history={claim.statusHistory}
                  currentStatus={claim.status}
                />
              </div>
            </Panel>
          )}

          {claim.decision && (
            <Panel key="decision" title="Decision Remarks" className="shrink-0">
              <div className="px-4 py-3">
                {claim.decision.remarks && (
                  <p className="rounded-md bg-neutral-50 p-2 text-[13px] text-neutral-700">
                    {claim.decision.remarks}
                  </p>
                )}
                {refundReceivedEntry && (
                  <div className="mt-2 border-t border-neutral-100 pt-2">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <StatusPill status="REFUND_RECEIVED_BY_IMGC" />
                      <span className="text-neutral-700">
                        by {refundReceivedEntry.byName} ·{" "}
                        {when(refundReceivedEntry.at)}
                      </span>
                    </p>
                    {claim.refundReceipt && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-neutral-600">
                        <span>
                          Date:{" "}
                          <span className="font-semibold text-neutral-900">
                            {whenDate(claim.refundReceipt.paymentDate)}
                          </span>
                        </span>
                        <span>
                          UTR No.:{" "}
                          <span className="font-semibold text-neutral-900">
                            {claim.refundReceipt.utr}
                          </span>
                        </span>
                        <span>
                          Amount:{" "}
                          <span className="font-semibold text-neutral-900">
                            ₹
                            {claim.refundReceipt.amount.toLocaleString("en-IN")}
                          </span>
                        </span>
                        {claim.refundReceipt.fileId && (
                          <a
                            href={`/api/portal/files/${claim.refundReceipt.fileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-medium text-brand-primary hover:underline"
                          >
                            <EyeIcon className="size-3.5" /> View proof
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}
        </>
      }
      documents={
        isLender ? (
          <div className="flex flex-col gap-3">
            <ClaimDocumentsTable
              accountId={claim.accountId}
              claimId={claim.id}
              documents={documents}
              locked={terminal}
              allowDelete={canDeleteFiles}
              claimStatus={claim.status}
            />
            <ClaimRemarksPanel
              lender={claimRemarks.lender}
              imgc={claimRemarks.imgc}
              decision={claimRemarks.decision}
            />
            {canResubmit && (
              <ActionFooter key="query-response" className="mt-4">
                <ResubmitClaimButton
                  accountId={claim.accountId}
                  claimId={claim.id}
                />
              </ActionFooter>
            )}
          </div>
        ) : (
          <Panel title="Documents">
            {/* 7 rows visible (32px header + 7 × ~46.5px row) before it scrolls. */}
            <div className="custom-scrollbar max-h-[358px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Document
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Required
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Version
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Status
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="px-1.5 py-1.5">
                        <span className="text-[12px] font-medium whitespace-nowrap text-neutral-900">
                          {d.name}
                        </span>
                        <span className="block text-[10.5px] whitespace-nowrap text-neutral-500">
                          {d.category}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-[11.5px] whitespace-nowrap text-neutral-600">
                        {d.required ? "Required" : "Optional"}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-[11.5px] whitespace-nowrap text-neutral-600">
                        {d.version > 0 ? `v${d.version}` : "—"}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        <StatusPill
                          status={d.status}
                          flat
                          className="text-[10.5px]"
                        />
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {d.file || d.files?.[0] ? (
                          <a
                            href={`/api/portal/files/${(d.file || (d.files && d.files[0]))?.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-primary"
                          >
                            <EyeIcon className="size-3" /> View
                          </a>
                        ) : (
                          <span className="text-[11px] text-neutral-400">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )
      }
      history={
        <Panel
          title="Claim History"
          description="Every status change and query on this claim, in order."
        >
          <ClaimHistory statusHistory={claim.statusHistory} queries={queries} />
        </Panel>
      }
    />
  ) : (
    <ClaimDetailTabs
      loanDetails={account ? <LoanDetailsCard account={account} /> : null}
      backLink={
        <div className="flex items-center gap-3">
          {isLender && (
            // Back to the claims grid as the lender left it - a tile's filter (e.g. Initiated)
            // survives the round trip into a claim and out again.
            <GridBackLink
              href={ROUTES.initiateClaim}
              storageKey={CLAIMS_FILTER_KEY}
              label="Back"
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            />
          )}
          {!terminal && !isLender && (
            <QueriedButton claimId={claim.id} claimNo={claim.claimNo} />
          )}
        </div>
      }
      statusAndQuery={
        <>
          {isLender ? (
            <LenderClaimStatusPanel
              key="claim-status"
              history={claim.statusHistory}
              currentStatus={claim.status}
            />
          ) : (
            <Panel key="claim-status" title="Claim Status" className="shrink-0">
              <div className="px-5 py-4">
                <ClaimStatusHistoryGraph
                  history={claim.statusHistory}
                  currentStatus={claim.status}
                />
              </div>
            </Panel>
          )}

          {claim.decision && (
            <Panel key="decision" title="Decision Remarks" className="shrink-0">
              <div className="px-4 py-3">
                {claim.decision.remarks && (
                  <p className="rounded-md bg-neutral-50 p-2 text-[13px] text-neutral-700">
                    {claim.decision.remarks}
                  </p>
                )}
                {refundReceivedEntry && (
                  <div className="mt-2 border-t border-neutral-100 pt-2">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <StatusPill status="REFUND_RECEIVED_BY_IMGC" />
                      <span className="text-neutral-700">
                        by {refundReceivedEntry.byName} ·{" "}
                        {when(refundReceivedEntry.at)}
                      </span>
                    </p>
                    {claim.refundReceipt && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-neutral-600">
                        <span>
                          Date:{" "}
                          <span className="font-semibold text-neutral-900">
                            {whenDate(claim.refundReceipt.paymentDate)}
                          </span>
                        </span>
                        <span>
                          UTR No.:{" "}
                          <span className="font-semibold text-neutral-900">
                            {claim.refundReceipt.utr}
                          </span>
                        </span>
                        <span>
                          Amount:{" "}
                          <span className="font-semibold text-neutral-900">
                            ₹
                            {claim.refundReceipt.amount.toLocaleString("en-IN")}
                          </span>
                        </span>
                        {claim.refundReceipt.fileId && (
                          <a
                            href={`/api/portal/files/${claim.refundReceipt.fileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-medium text-brand-primary hover:underline"
                          >
                            <EyeIcon className="size-3.5" /> View proof
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Resubmission is the lender's move — this slot renders for both roles, so IMGC must
              not be offered it here (the single-page layout's own copy sits inside a lender-only
              branch already). */}
          {isLender && canResubmit && (
            <ActionFooter key="query-response" className="mt-4">
              <ResubmitClaimButton
                accountId={claim.accountId}
                claimId={claim.id}
              />
            </ActionFooter>
          )}
        </>
      }
      documents={
        isLender ? (
          <div className="flex flex-col gap-6">
            <ClaimDocumentsTable
              accountId={claim.accountId}
              claimId={claim.id}
              documents={documents}
              locked={terminal}
              allowDelete={canDeleteFiles}
              claimStatus={claim.status}
            />
            <ClaimRemarksPanel
              lender={claimRemarks.lender}
              imgc={claimRemarks.imgc}
              decision={claimRemarks.decision}
            />
          </div>
        ) : (
          <Panel title="Documents">
            {/* 7 rows visible (32px header + 7 × ~46.5px row) before it scrolls. */}
            <div className="custom-scrollbar max-h-[358px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Document
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Required
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Version
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Status
                    </TableHead>
                    <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="px-1.5 py-1.5">
                        <span className="text-[12px] font-medium whitespace-nowrap text-neutral-900">
                          {d.name}
                        </span>
                        <span className="block text-[10.5px] whitespace-nowrap text-neutral-500">
                          {d.category}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-[11.5px] whitespace-nowrap text-neutral-600">
                        {d.required ? "Required" : "Optional"}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-[11.5px] whitespace-nowrap text-neutral-600">
                        {d.version > 0 ? `v${d.version}` : "—"}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        <StatusPill
                          status={d.status}
                          flat
                          className="text-[10.5px]"
                        />
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {d.file || d.files?.[0] ? (
                          <a
                            href={`/api/portal/files/${(d.file || (d.files && d.files[0]))?.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-primary"
                          >
                            <EyeIcon className="size-3" /> View
                          </a>
                        ) : (
                          <span className="text-[11px] text-neutral-400">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )
      }
      history={
        <Panel
          title="Claim History"
          description="Every status change and query on this claim, in order."
        >
          <ClaimHistory statusHistory={claim.statusHistory} queries={queries} />
        </Panel>
      }
    />
  );

  return (
    <PortalShell
      activeKey="initiate-claim"
      title={
        isLender ? `Claim No. ${claim.claimNo}` : `Claim No. ${claim.claimNo}`
      }
      titleAside={
        account
          ? `₹${claimAmountFor(account.loanAmount).toLocaleString("en-IN")}`
          : undefined
      }
      claimAgeing={<LiveClaimAgeing statusHistory={claim.statusHistory} />}
    >
      <div
        className={
          isSingleView ? "flex flex-col" : "flex flex-col overflow-hidden"
        }
      >
        {layoutContent}
      </div>
    </PortalShell>
  );
}
