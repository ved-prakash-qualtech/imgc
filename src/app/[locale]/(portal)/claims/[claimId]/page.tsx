import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  FileTextIcon,
  InboxIcon,
  MessageSquareWarningIcon,
} from "lucide-react";

import { ClaimQueryDialog } from "@/components/portal/ClaimQueryDialog";
import { ClaimTimeline } from "@/components/portal/ClaimTimeline";
import { CommandBand } from "@/components/portal/CommandBand";
import { Panel } from "@/components/portal/Panel";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { claimConfig, CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { listAuditForAccount } from "@/services/portal/audit.server";
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

function Fact({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="px-5 py-3">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-neutral-900">{value}</dd>
    </div>
  );
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

  const [documents, queries, audit] = await Promise.all([
    listClaimDocuments(session, claim.id),
    listQueries(claim.id),
    listAuditForAccount(claim.accountId),
  ]);
  const config = claimConfig(claim.claimType);
  const isLender = session.role === "LENDER";
  const terminal =
    claim.status === "APPROVED" ||
    claim.status === "REJECTED" ||
    claim.status === "CLOSED";

  const requiredAction = claim.openQuery
    ? "Respond to the open query"
    : claim.status === "DRAFT"
      ? "Complete and submit the claim"
      : claim.status === "QUERY_RAISED"
        ? "Upload the requested documents"
        : isLender
          ? "Nothing — with IMGC"
          : "IMGC review";

  return (
    <PortalShell
      activeKey="initiate-claim"
      title={`Claim · ${claim.claimNo}`}
    >
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaim}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> All claims
        </Link>

        <CommandBand
          title={`${claim.claimNo} · ${claim.typeLabel}`}
          subtitle={`${claim.caseId} · ${claim.customerName} · ${claim.lenderName}`}
          stats={[
            {
              icon: <ClipboardListIcon className="size-4" />,
              label: "Current status",
              value: CLAIM_STATUS_LABELS[claim.status],
              caption: `updated ${when(claim.lastUpdatedAt).split(",")[0]}`,
              accent: claim.status === "REJECTED" ? "rose" : undefined,
            },
            {
              icon: <FileTextIcon className="size-4" />,
              label: "Documents approved",
              value: `${claim.approvedDocs}/${claim.requiredDocs}`,
              caption: "mandatory documents",
              accent: "teal",
            },
            {
              icon: <InboxIcon className="size-4" />,
              label: "Assigned bucket",
              value: claim.bucket,
              caption:
                claim.bucket === "IMGC" ? "with IMGC" : "with the lender",
              accent: claim.bucket === "LENDER" ? "amber" : undefined,
            },
            {
              icon: <MessageSquareWarningIcon className="size-4" />,
              label: "Required action",
              value: String(queries.filter((q) => !q.respondedAt).length),
              caption: requiredAction,
              accent: claim.openQuery ? "rose" : undefined,
            },
          ]}
          action={
            <div className="flex items-center gap-2">
              {claim.openQuery && isLender && (
                <Button
                  size="sm"
                  render={
                    <Link href={ROUTES.initiateClaimWorkspace(claim.accountId)} />
                  }
                >
                  Respond to query
                </Button>
              )}
              {!terminal && (
                <ClaimQueryDialog
                  claimId={claim.id}
                  claimNo={claim.claimNo}
                  role={session.role}
                  requestableDocuments={config.documents.map((d) => d.name)}
                />
              )}
            </div>
          }
        />

        {/* ── Claim facts ──────────────────────────────────────── */}
        <Panel title="Claim">
          <dl className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            <Fact label="Claim number" value={claim.claimNo} />
            <Fact label="Account number" value={claim.caseId} />
            <Fact label="Customer name" value={claim.customerName} />
            <Fact label="Claim type" value={claim.typeLabel} />
            <Fact
              label="Submitted on"
              value={claim.submittedAt ? when(claim.submittedAt) : "Not yet submitted"}
            />
            <Fact label="Current status" value={<StatusPill status={claim.status} />} />
            <Fact label="Last updated" value={when(claim.lastUpdatedAt)} />
            <Fact label="Assigned bucket" value={<StatusPill status={claim.bucket} />} />
          </dl>
        </Panel>

        {/* ── Timeline ─────────────────────────────────────────── */}
        <Panel
          title="Status timeline"
          description="Derived from the claim type's configured flow and this claim's own history."
        >
          <div className="px-5 py-4">
            <ClaimTimeline
              claimType={claim.claimType}
              status={claim.status}
              history={claim.statusHistory}
            />
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

        {/* ── Submitted details ────────────────────────────────── */}
        <Panel title={`${config.label} details`}>
          <dl className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {config.fields.map((f) => (
              <Fact
                key={f.id}
                label={f.label}
                value={claim.fields[f.id]?.trim() || "—"}
              />
            ))}
          </dl>
        </Panel>

        {/* ── Documents ────────────────────────────────────────── */}
        <Panel title="Documents">
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
                      <span className="font-medium text-neutral-900">{d.name}</span>
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

        {/* ── Queries ──────────────────────────────────────────── */}
        {queries.length > 0 && (
          <Panel title={`Queries (${queries.length})`}>
            <ol className="divide-y divide-neutral-100">
              {queries.map((q) => (
                <li key={q.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={q.respondedAt ? "APPROVED" : "QUERY_RAISED"} />
                    <span className="text-[13.5px] font-semibold text-neutral-950">
                      {q.reason}
                    </span>
                    <span className="text-[11.5px] text-neutral-500">
                      {q.raisedByName} · {when(q.raisedAt)}
                    </span>
                  </div>
                  {q.remarks && (
                    <p className="mt-1 text-[12.5px] text-neutral-600">{q.remarks}</p>
                  )}
                  {q.requestedDocuments.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {q.requestedDocuments.map((n) => (
                        <span
                          key={n}
                          className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
                        >
                          {n}
                        </span>
                      ))}
                    </p>
                  )}
                  {q.respondedAt && (
                    <p className="mt-2 rounded-md bg-success/8 px-3 py-1.5 text-[12.5px] text-neutral-700">
                      Answered by {q.respondedByName} · {when(q.respondedAt)}
                      {q.responseRemarks ? ` — ${q.responseRemarks}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {/* ── Audit ────────────────────────────────────────────── */}
        <Panel
          title="Audit trail"
          description="Every action recorded against this account, newest first."
        >
          <ol className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
            {audit.length === 0 ? (
              <li className="px-5 py-10 text-center text-[13px] text-neutral-500">
                Nothing recorded yet.
              </li>
            ) : (
              audit.map((e) => (
                <li key={e.id} className="flex gap-3 px-5 py-3">
                  <span className="w-[130px] shrink-0 text-[11.5px] text-neutral-400">
                    {when(e.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[12.5px] font-medium text-neutral-800">
                      {e.actorName}
                      <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        {e.actorRole}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-neutral-600">
                      {e.summary}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ol>
        </Panel>
      </div>
    </PortalShell>
  );
}
