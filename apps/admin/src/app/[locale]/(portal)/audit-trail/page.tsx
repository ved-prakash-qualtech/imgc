import { getTranslations } from "next-intl/server";
import { redirectTo } from "@imgc/lib/zoneRedirect";

import { AuditTrailClient } from "@/app/[locale]/(portal)/audit-trail/AuditTrailClient";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { listAccounts } from "@imgc/data/services/portal/accounts.server";
import { listRecentAudit } from "@imgc/data/services/portal/audit.server";
import { ROUTES } from "@imgc/constants/route";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage() {
  const session = await requireSession();

  if (session.role !== "LENDER") {
    redirectTo(ROUTES.accounts);
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

  const tTitles = await getTranslations("shell.pageTitles");
  return (
    <PortalShell activeKey="initiate-claim" title={tTitles("auditTrail")}>
      <AuditTrailClient events={events} accountMap={accountMap} />
    </PortalShell>
  );
}
