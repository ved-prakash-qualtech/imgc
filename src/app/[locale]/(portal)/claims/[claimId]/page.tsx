/* eslint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop */
import { notFound } from "next/navigation";

import { ClaimHistory } from "@/components/portal/ClaimHistory";
import { ClaimQueryDialog } from "@/components/portal/ClaimQueryDialog";
import { ClaimStatusHistoryGraph } from "@/components/portal/ClaimStatusHistoryGraph";
import { CommandBand } from "@/components/portal/CommandBand";
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
import { requireSession } from "@/lib/auth/appSession";
import { getAccount } from "@/services/portal/accounts.server";
import { getClaim, listQueries } from "@/services/portal/claimFlow.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

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
      title={`Track Claim · ${claim.claimNo}`}
    >
      <div className="space-y-6">
        <CommandBand
          title={`${claim.claimNo} · ${claim.typeLabel}`}
          subtitle={`${claim.caseId} · ${claim.customerName} · ${claim.lenderName} · Claim Amount ${account ? inr.format(account.outstandingAmount) : "—"}`}
          stats={[]}
          action={
            !terminal && (
              <ClaimQueryDialog
                claimId={claim.id}
                claimNo={claim.claimNo}
                role={session.role}
                requestableDocuments={config.documents.map((d) => d.name)}
              />
            )
          }
        />

        {/* ── Section nav — this is one long page, not four; the anchors just let a
             reader jump straight to Query or History instead of scrolling past
             Documents to find them. ── */}
        <nav
          aria-label="Sections on this page"
          className="sticky top-0 z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-neutral-100 bg-white/95 px-6 py-2 backdrop-blur"
        >
          <a href="#status" className={SECTION_LINK_CLASS}>
            Status
          </a>
          <a href="#query" className={SECTION_LINK_CLASS}>
            Query Response
          </a>
          <a href="#history" className={SECTION_LINK_CLASS}>
            History
          </a>
          <a href="#documents" className={SECTION_LINK_CLASS}>
            Documents
          </a>
        </nav>

        {/* ── 2. Claim Status Line Graph ───────────────────────── */}
        <Panel
          id="status"
          className="scroll-mt-14"
          title="Claim Status"
          description="Generated from this claim's own status history — only what has actually happened."
        >
          <div className="px-5 py-4">
            <ClaimStatusHistoryGraph history={claim.statusHistory} />
          </div>
        </Panel>

        {claim.decision && (
          <Panel title="Decision">
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

        {/* ── 3. Query Response ─────────────────────────────────── */}
        <div id="query" className="scroll-mt-14">
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
          />
        </div>

        {/* ── 4. Claim History — every status change and past query, merged into
             one chronological record so nothing that happened to this claim needs
             a second panel to find it. ── */}
        <Panel
          id="history"
          className="scroll-mt-14"
          title="Claim History"
          description="Every status change and query on this claim, in order."
        >
          <ClaimHistory statusHistory={claim.statusHistory} queries={queries} />
        </Panel>

        {/* ── Documents ────────────────────────────────────────── */}
        <Panel id="documents" className="scroll-mt-14" title="Documents">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="font-medium text-neutral-900">
                        {d.name}
                      </span>
                      <span className="block text-[11.5px] text-neutral-500">
                        {d.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12.5px] text-neutral-600">
                      {d.required ? "Required" : "Optional"}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-neutral-600">
                      {d.version > 0 ? `v${d.version}` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={d.status} />
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="line-clamp-2 text-[12.5px] text-neutral-600">
                        {d.latestRemark || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>
    </PortalShell>
  );
}

const SECTION_LINK_CLASS =
  "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900";
