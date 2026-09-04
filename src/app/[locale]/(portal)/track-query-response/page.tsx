import { FileClockIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { TrackCasesClient } from "@/app/[locale]/(portal)/track-query-response/TrackCasesClient";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { ROUTES } from "@/constants/route";

export const dynamic = "force-dynamic";

function getTrackQueryStats(
  trackCasesCount: number,
  queriedCount: number
): BandStatProps[] {
  return [
    {
      icon: <FileClockIcon className="size-4" />,
      label: "Active Claims",
      value: String(trackCasesCount),
      caption: `${queriedCount} require attention`,
      accent: queriedCount > 0 ? "amber" : "teal",
    },
  ];
}

export default async function TrackQueryResponsePage() {
  const session = await requireSession();

  // Protect route
  if (session.role !== "LENDER") {
    redirect(ROUTES.accounts);
  }

  const accounts = await listAccounts(session);
  const trackCases = accounts.filter((a) => a.claimStatus !== "DRAFT");

  const queriedCount = trackCases.filter(
    (a) => a.claimStatus === "QUERIED"
  ).length;

  const stats = getTrackQueryStats(trackCases.length, queriedCount);

  return (
    <PortalShell
      activeKey="track-query-response"
      title="Track & Query Response"
    >
      <div className="space-y-6">
        <CommandBand
          title="Track & Query Response"
          subtitle="Monitor submitted claims and respond to IMGC queries."
          stats={stats}
        />
        <TrackCasesClient accounts={trackCases} />
      </div>
    </PortalShell>
  );
}
