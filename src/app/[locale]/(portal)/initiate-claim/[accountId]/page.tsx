import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { getAccount } from "@/services/portal/accounts.server";
import { ClaimTypeSelectorClient } from "@/app/[locale]/(portal)/initiate-claim/[accountId]/ClaimTypeSelectorClient";

export const dynamic = "force-dynamic";

function getInitiateClaimDetailStats(account: {
  npa: boolean;
  writeOff: boolean;
  stage: string;
  claimStatus: string;
}): BandStatProps[] {
  return [
    {
      label: "NPA Status",
      value: account.npa ? "YES" : "NO",
      caption: "Eligibility flag",
      accent: account.npa ? "amber" : undefined,
    },
    {
      label: "Write-off Status",
      value: account.writeOff ? "YES" : "NO",
      caption: "Eligibility flag",
      accent: account.writeOff ? "amber" : undefined,
    },
    {
      label: "Current Stage",
      value: account.stage,
      caption: "Processing step",
    },
    {
      label: "Claim Status",
      value: account.claimStatus,
      caption: "Overall status",
    },
  ];
}

export default async function InitiateClaimDetailsPage({
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

  const stats = getInitiateClaimDetailStats(account);

  return (
    <PortalShell
      activeKey="initiate-claim"
      title={`Initiate Claim - ${account.loanNo}`}
    >
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaim}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> Eligible Cases
        </Link>

        <CommandBand
          title={`${account.loanNo} · ${account.borrowerName}`}
          subtitle={`${account.lenderOrgName} · ${account.product} · POS / NPA Status`}
          stats={stats}
        />

        <ClaimTypeSelectorClient accountId={account.id} />
      </div>
    </PortalShell>
  );
}
