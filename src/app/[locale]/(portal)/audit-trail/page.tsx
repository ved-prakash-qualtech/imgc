import { redirect } from "next/navigation";

import { AuditTrailClient } from "@/app/[locale]/(portal)/audit-trail/AuditTrailClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { listRecentAudit } from "@/services/portal/audit.server";
import { ROUTES } from "@/constants/route";

export const dynamic = "force-dynamic";

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

  return (
    <PortalShell activeKey="audit-trail" title="Audit Trail">
      <AuditTrailClient events={events} accountMap={accountMap} />
    </PortalShell>
  );
}
