import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { RETENTION_DAYS } from "@/server/mock/retention";
import { getAccount } from "@/services/portal/accounts.server";
import { canSubmit, listDocuments } from "@/services/portal/claims.server";

export const dynamic = "force-dynamic";

function getInitialClaimWorkflowStats(
  docsIn: number,
  docsRequired: number,
  claimStatus: string
): BandStatProps[] {
  return [
    {
      label: "Document readiness",
      value: docsRequired
        ? `${Math.round((docsIn / docsRequired) * 100)}%`
        : "0%",
      caption: `${docsIn} of ${docsRequired} mandatory in`,
      accent: "teal",
    },
    {
      label: "Claim status",
      value: claimStatus,
      caption: "Current claim status",
    },
  ];
}

export default async function InitialClaimWorkflowPage({
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
  if (!account || (!account.npa && !account.writeOff)) {
    notFound();
  }

  const docs = await listDocuments(session, accountId);
  const docsIn = docs.filter(
    (d) => d.required && (d.status === "UPLOADED" || d.status === "ACCEPTED")
  ).length;
  const docsRequired = docs.filter((d) => d.required).length;

  const stats = getInitialClaimWorkflowStats(
    docsIn,
    docsRequired,
    account.claimStatus
  );

  return (
    <PortalShell
      activeKey="initiate-claim"
      title={`Initial Claim - ${account.loanNo}`}
    >
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaimWorkspace(accountId)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> Back to Claim Type Selection
        </Link>

        <CommandBand
          title={`Initial Claim · ${account.loanNo}`}
          subtitle={`${account.borrowerName} · ${account.lenderOrgName} · ${account.product}`}
          stats={stats}
        />

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Document Upload
          </h2>
          <InitialClaimsTab
            accountId={account.id}
            role={session.role}
            docs={docs}
            claimStatus={account.claimStatus}
            canSubmit={canSubmit(docs)}
            retentionDays={RETENTION_DAYS}
          />
        </div>
      </div>
    </PortalShell>
  );
}
