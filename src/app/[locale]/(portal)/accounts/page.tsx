import { AccountsClient } from "@/app/[locale]/(portal)/accounts/AccountsClient";

import { ClaimOverviewBand } from "@/components/portal/ClaimOverviewBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import {
  listClaims,
  summariseClaimOverview,
  type ClaimOverviewCounts,
} from "@/services/portal/claimFlow.server";

export const dynamic = "force-dynamic";

/** Each tile links to this same grid, pre-filtered to the exact bucket it counted — the grid
 *  reads the same `?status=` values back out via `statusFromParam` in AccountsClient. Same
 *  scheme the Lender's own Claim page uses (initiate-claim/page.tsx). */
const CLAIM_OVERVIEW_HREFS: Record<keyof ClaimOverviewCounts, string> = {
  total: ROUTES.accounts,
  initiation: `${ROUTES.accounts}?status=DRAFT`,
  underProgress: `${ROUTES.accounts}?status=UNDER_PROGRESS`,
  approved: `${ROUTES.accounts}?status=APPROVED`,
  rejected: `${ROUTES.accounts}?status=REJECTED`,
};

export default async function AccountsPage() {
  const session = await requireSession();
  const [allAccounts, claims] = await Promise.all([
    listAccounts(session),
    listClaims(session),
  ]);

  // Strictly DPD > 90 — same rule the Lender's own Claim page (initiate-claim/page.tsx) applies,
  // and the same fold `classifyLoanStatus` builds `loanStatus` on top of: a claim only belongs on
  // the Claims screen once its account is actually eligible. `All Loans` (/dpd) is the
  // unrestricted view of every account regardless of DPD — this page is not that. `>` is
  // deliberate — exactly 90 does not qualify, only 91+.
  const accounts = allAccounts.filter((a) => (a.dpd ?? 0) > 90);

  // Same hero band the Lender's own Claim page shows, over this page's own eligible-accounts set
  // — `summariseClaimOverview` is the one place that classifies a claim into these five buckets,
  // so the two pages can never quietly disagree about what "under progress" or "approved" means.
  const claimByAccountId = new Map(claims.map((c) => [c.accountId, c]));
  const claimOverview = summariseClaimOverview(
    accounts.map((a) => ({ claim: claimByAccountId.get(a.id) ?? null }))
  );

  return (
    <PortalShell activeKey="accounts" title="Claims">
      <div className="space-y-4">
        <ClaimOverviewBand
          counts={claimOverview}
          hrefs={CLAIM_OVERVIEW_HREFS}
          title="Claims Overview"
          subtitle="Where every claim currently stands"
        />
        <AccountsClient accounts={accounts} role={session.role} />
      </div>
    </PortalShell>
  );
}
