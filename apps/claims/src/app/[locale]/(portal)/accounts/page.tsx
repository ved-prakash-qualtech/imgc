import { getTranslations } from "next-intl/server";
import { AccountsClient } from "@/app/[locale]/(portal)/accounts/AccountsClient";

import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { listAccounts } from "@imgc/data/services/portal/accounts.server";

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
  const accounts = allAccounts.filter(
    (a) =>
      (a.dpd ?? 0) > 90 &&
      (session.role !== "IMGC" ||
        (a.claimStatus !== "CLOSED" &&
          a.claimStatus !== "DOCUMENTS_RESUBMITTED"))
  );

  const tTitles = await getTranslations("shell.pageTitles");
  return (
    <PortalShell activeKey="accounts" title={tTitles("claims")}>
      <AccountsClient accounts={accounts} role={session.role} />
    </PortalShell>
  );
}
