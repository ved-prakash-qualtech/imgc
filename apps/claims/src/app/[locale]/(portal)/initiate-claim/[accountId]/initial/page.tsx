/* eslint-disable react-perf/jsx-no-new-array-as-prop -- pre-existing in this file: the indexed maps are declared
   here with literal keys, and the inline props are small local values. Left as-is so the
   type-scale change stays a class rename. */
import { getTranslations } from "next-intl/server";
import { redirectTo } from "@imgc/lib/zoneRedirect";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
import { CommandBand } from "@imgc/features/portal/CommandBand";
import type { BandStatProps } from "@imgc/features/portal/CommandBand";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { ROUTES } from "@imgc/constants/route";
import { requireSession } from "@imgc/lib/auth/appSession";
import { RETENTION_DAYS } from "@imgc/data/server/mock/retention";
import { getAccount } from "@imgc/data/services/portal/accounts.server";
import {
  canSubmit,
  listDocuments,
} from "@imgc/data/services/portal/claims.server";

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
    redirectTo(ROUTES.accounts);
  }

  const account = await getAccount(session, accountId);
  if (!account || (!account.npa && !account.writeOff)) {
    notFound();
  }

  const docs = await listDocuments(session, accountId);
  const docsIn = docs.filter(
    (d) =>
      d.required && (d.status === "UNDER_REVIEW" || d.status === "APPROVED")
  ).length;
  const docsRequired = docs.filter((d) => d.required).length;

  const stats = getInitialClaimWorkflowStats(
    docsIn,
    docsRequired,
    account.claimStatus
  );

  const t = await getTranslations("claim");
  return (
    <PortalShell
      activeKey="initiate-claim"
      title={`Initial Claim - ${account.loanNo}`}
    >
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaimWorkspace(accountId)}
          className="inline-flex items-center gap-1.5 text-ui-subhead font-medium text-neutral-500 hover:text-neutral-800"
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
            {t("documentUpload")}
          </h2>
          <InitialClaimsTab
            accountId={account.id}
            accountProduct={account.product}
            role={session.role}
            docs={docs}
            claimStatus={account.claimStatus}
            canSubmit={canSubmit(docs)}
            retentionDays={RETENTION_DAYS}
            queriedDocNames={[]}
          />
        </div>
      </div>
    </PortalShell>
  );
}
