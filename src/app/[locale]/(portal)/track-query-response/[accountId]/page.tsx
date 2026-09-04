import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingIcon,
  FileClockIcon,
  InboxIcon,
  UploadCloudIcon,
} from "lucide-react";

import { AccountWorkspace } from "@/app/[locale]/(portal)/accounts/[accountId]/AccountWorkspace";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { RETENTION_DAYS } from "@/server/mock/retention";
import { getAccount } from "@/services/portal/accounts.server";
import { listAuditForAccount } from "@/services/portal/audit.server";
import { canSubmit, listDocuments } from "@/services/portal/claims.server";
import { pullFromPas } from "@/services/portal/pas.server";
import { listRemarks } from "@/services/portal/remarks.server";

export const dynamic = "force-dynamic";

function getTrackCaseStats(params: {
  readiness: number;
  docsIn: number;
  docsRequired: number;
  claimStatus: string;
  submittedAt?: string | null;
  bucket: string;
  eventsCount: number;
  remarksCount: number;
}): BandStatProps[] {
  return [
    {
      icon: <UploadCloudIcon className="size-4" />,
      label: "Document readiness",
      value: `${params.readiness}%`,
      caption: `${params.docsIn} of ${params.docsRequired} mandatory in`,
      accent: "teal",
    },
    {
      icon: <FileClockIcon className="size-4" />,
      label: "Claim status",
      value: params.claimStatus,
      caption: params.submittedAt
        ? `submitted ${new Date(params.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
        : "not yet submitted",
      accent: params.claimStatus === "QUERIED" ? "amber" : undefined,
    },
    {
      icon: <InboxIcon className="size-4" />,
      label: "Processing bucket",
      value: params.bucket,
      caption:
        params.bucket === "IMGC"
          ? "IMGC is processing this account"
          : "with the lender for documents",
      accent: params.bucket === "LENDER" ? "amber" : undefined,
    },
    {
      icon: <BuildingIcon className="size-4" />,
      label: "Activity",
      value: String(params.eventsCount),
      caption: `${params.remarksCount} remark(s) on record`,
    },
  ];
}

export default async function TrackQueryWorkspacePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const session = await requireSession();

  if (session.role !== "LENDER") {
    redirect(ROUTES.accounts);
  }

  const account = await getAccount(session, accountId);
  if (!account || account.claimStatus === "DRAFT") {
    notFound();
  }

  const [docs, pasValues, remarks, events] = await Promise.all([
    listDocuments(session, accountId),
    pullFromPas(session, accountId),
    listRemarks(accountId),
    listAuditForAccount(accountId),
  ]);

  const docsIn = docs.filter(
    (d) => d.required && (d.status === "UNDER_REVIEW" || d.status === "APPROVED")
  ).length;
  const docsRequired = docs.filter((d) => d.required).length;
  const readiness = docsRequired
    ? Math.round((docsIn / docsRequired) * 100)
    : 0;

  const stats = getTrackCaseStats({
    readiness,
    docsIn,
    docsRequired,
    claimStatus: account.claimStatus,
    submittedAt: account.submittedAt,
    bucket: account.bucket,
    eventsCount: events.length,
    remarksCount: remarks.length,
  });

  return (
    <PortalShell
      activeKey="track-query-response"
      title={`Track Case - ${account.loanNo}`}
    >
      <div className="space-y-6">
        <Link
          href={ROUTES.trackQueryResponse}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> Back to Track & Query Response
        </Link>

        <CommandBand
          title={`${account.loanNo} · ${account.borrowerName}`}
          subtitle={`${account.lenderOrgName} · ${account.product} · ${account.stage}`}
          stats={stats}
        />

        <AccountWorkspace
          account={account}
          role={session.role}
          docs={docs}
          pasValues={pasValues}
          remarks={remarks}
          events={events}
          canSubmit={canSubmit(docs)}
          retentionDays={RETENTION_DAYS}
        />
      </div>
    </PortalShell>
  );
}
