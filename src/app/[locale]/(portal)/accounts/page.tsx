/* eslint-disable react-perf/jsx-no-new-array-as-prop */

import { AccountsClient } from "@/app/[locale]/(portal)/accounts/AccountsClient";

import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { buildDashboardSummary } from "@/services/portal/dashboard.server";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await requireSession();
  const [accounts, summary] = await Promise.all([
    listAccounts(session),
    buildDashboardSummary(session),
  ]);

  const isLender = session.role === "LENDER";

  return (
    <PortalShell activeKey="accounts" title="Claims">
      <div className="space-y-4">


        <AccountsClient accounts={accounts} role={session.role} />
      </div>
    </PortalShell>
  );
}
