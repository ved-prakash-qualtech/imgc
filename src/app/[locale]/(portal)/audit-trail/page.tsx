import { ListTreeIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AuditTrailClient } from "@/app/[locale]/(portal)/audit-trail/AuditTrailClient";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { listRecentAudit } from "@/services/portal/audit.server";
import { ROUTES } from "@/constants/route";

export const dynamic = "force-dynamic";

function getAuditTrailStats(count: number): BandStatProps[] {
  return [
    {
      icon: <ListTreeIcon className="size-4" />,
      label: "Recent Events",
      value: String(count),
      caption: "Across all accounts",
    },
  ];
}

export default async function AuditTrailPage() {
  const session = await requireSession();

  if (session.role !== "LENDER") {
    redirect(ROUTES.accounts);
  }

  const accounts = await listAccounts(session);
  const accountIds = accounts.map((a) => a.id);

  const events = await listRecentAudit(accountIds, 200);

  const accountMap = accounts.reduce(
    (acc, account) => {
      acc[account.id] = account;
      return acc;
    },
    {} as Record<string, { loanNo: string; borrowerName: string }>
  );

  const stats = getAuditTrailStats(events.length);

  return (
    <PortalShell activeKey="audit-trail" title="Audit Trail">
      <div className="space-y-6">
        <CommandBand
          title="Audit Trail"
          subtitle="Global view of relevant audit events for your accounts."
          stats={stats}
        />
        <AuditTrailClient events={events} accountMap={accountMap} />
      </div>
    </PortalShell>
  );
}
