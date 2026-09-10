/* eslint-disable react-perf/jsx-no-jsx-as-prop */
import { ArrowLeftIcon, EyeIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { ClaimDetailTabs } from "@/components/portal/ClaimDetailTabs";
import { ClaimHistory } from "@/components/portal/ClaimHistory";
import { ClaimQueryDialog } from "@/components/portal/ClaimQueryDialog";
import { ClaimStatusHistoryGraph } from "@/components/portal/ClaimStatusHistoryGraph";
import { LoanDetailsCard } from "@/components/portal/LoanDetailsCard";
import { Panel } from "@/components/portal/Panel";
import { PortalShell } from "@/components/portal/PortalShell";
import { QueryResponseSection } from "@/components/portal/QueryResponseSection";
import { StatusPill } from "@/components/portal/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { claimConfig } from "@/config/claimConfig";
import { ROUTES } from "@/constants/route";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth/appSession";
import { getAccount } from "@/services/portal/accounts.server";
import { getClaim, listQueries } from "@/services/portal/claimFlow.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";

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

/** Track Claim / Claim Details — the same page for both roles, scoped by the service. */
export default async function ClaimDetailsPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const { claimId } = await params;
  const session = await requireSession();

  const claim = await getClaim(session, claimId);
  if (!claim) notFound();

  const [documents, queries, account] = await Promise.all([
    listClaimDocuments(session, claim.id),
    listQueries(claim.id),
    getAccount(session, claim.accountId),
  ]);
  const config = claimConfig(claim.claimType);
  const isLender = session.role === "LENDER";
  const terminal =
    claim.status === "APPROVED" ||
    claim.status === "REJECTED" ||
    claim.status === "CLOSED";

  return (
    <PortalShell
      activeKey="initiate-claim"
      title={`Track Claim · ${claim.customerName} · ${claim.claimNo}`}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: "calc(100vh - 5.5rem)" }}
      >
        <ClaimDetailTabs
          loanDetails={account ? <LoanDetailsCard account={account} /> : null}
          backLink={
            <div className="flex items-center gap-3">
              {isLender && (
                <Link
                  href={ROUTES.initiateClaim}
                  className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <ArrowLeftIcon className="size-3" /> Back
                </Link>
              )}
              {!terminal && !isLender && (
                <ClaimQueryDialog
                  claimId={claim.id}
                  claimNo={claim.claimNo}
                  role={session.role}
                  requestableDocuments={config.documents.map((d) => d.name)}
                />
              )}
            </div>
          }
          statusAndQuery={
            <>
              <Panel title="Claim Status" className="shrink-0">
                <div className="px-5 py-4">
                  <ClaimStatusHistoryGraph
                    history={claim.statusHistory}
                    currentStatus={claim.status}
                  />
                </div>
              </Panel>

              {claim.decision && (
                <Panel title="Decision" className="shrink-0">
                  <div className="px-5 py-4">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <StatusPill status={claim.decision.outcome} />
                      <span className="text-neutral-700">
                        by {claim.decision.byName} · {when(claim.decision.at)}
                      </span>
                    </p>
                    {claim.decision.remarks && (
                      <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700">
                        {claim.decision.remarks}
                      </p>
                    )}
                  </div>
                </Panel>
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                <QueryResponseSection
                  accountId={claim.accountId}
                  claimId={claim.id}
                  claimStatus={claim.status}
                  openQuery={claim.openQuery}
                  queries={queries.sort((a, b) =>
                    a.raisedAt.localeCompare(b.raisedAt)
                  )}
                  savedResponse={claim.fields.__queryResponse ?? ""}
                  documents={documents}
                  isLender={isLender}
                  fillLayout
                />
              </div>
            </>
          }
          documents={
            <Panel title="Documents">
              <div className="custom-scrollbar max-h-[267px] overflow-y-auto overflow-x-auto">
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
                      <TableHead className="h-8 px-1.5 text-[10.5px] sticky top-0 bg-white shadow-sm z-10 text-right">
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
                            className="px-1.5 py-0.5 text-[10.5px]"
                          />
                        </TableCell>
                        <TableCell className="px-1.5 py-1.5 text-right">
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
          }
          history={
            /* Every status change and past query, merged into one chronological record. */
            <Panel
              title="Claim History"
              description="Every status change and query on this claim, in order."
            >
              <ClaimHistory
                statusHistory={claim.statusHistory}
                queries={queries}
              />
            </Panel>
          }
        />
      </div>
    </PortalShell>
  );
}
