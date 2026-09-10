import { AccountsClient } from "@/app/[locale]/(portal)/accounts/AccountsClient";

import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";

// The Claims Overview band moved to the Claim Dashboard (/claim-dashboard); this page is the
// grid alone now.
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await requireSession();
  const allAccounts = await listAccounts(session);

  // Strictly DPD > 90 — same rule the Lender's own Claim page (initiate-claim/page.tsx) applies,
  // and the same fold `classifyLoanStatus` builds `loanStatus` on top of: a claim only belongs on
  // the Claims screen once its account is actually eligible. `All Loans` (/dpd) is the
  // unrestricted view of every account regardless of DPD — this page is not that. `>` is
  // deliberate — exactly 90 does not qualify, only 91+.
  const accounts = allAccounts.filter((a) => (a.dpd ?? 0) > 90);

  return (
    <PortalShell activeKey="accounts" title="Claims">
      <AccountsClient accounts={accounts} role={session.role} />
    </PortalShell>
  );
}
