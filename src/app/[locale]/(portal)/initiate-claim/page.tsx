import { AlertTriangleIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { ROUTES } from "@/constants/route";

export const dynamic = "force-dynamic";

function getInitiateClaimStats(count: number): BandStatProps[] {
  return [
    {
      icon: <AlertTriangleIcon className="size-4" />,
      label: "Eligible Cases",
      value: String(count),
      caption: "Tagged as NPA or Write-off",
      accent: "amber",
    },
  ];
}

export default async function InitiateClaimPage() {
  const session = await requireSession();

  // Protect route
  if (session.role !== "LENDER") {
    redirect(ROUTES.accounts);
  }

  const accounts = await listAccounts(session);
  const eligibleCases = accounts.filter((a) => a.npa || a.writeOff);

  const stats = getInitiateClaimStats(eligibleCases.length);

  return (
    <PortalShell activeKey="initiate-claim" title="Initiate Claim">
      <div className="space-y-6">
        <CommandBand
          title="Initiate Claim"
          subtitle="Cases eligible for claim initiation based on NPA or Write-off status."
          stats={stats}
        />
        <EligibleCasesClient accounts={eligibleCases} />
      </div>
    </PortalShell>
  );
}
