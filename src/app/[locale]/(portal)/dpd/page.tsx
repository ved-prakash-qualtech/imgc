import { DpdClient } from "@/app/[locale]/(portal)/dpd/DpdClient";
import type { EligibleRow } from "@/app/[locale]/(portal)/initiate-claim/page";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { getClaimAction, listClaims } from "@/services/portal/claimFlow.server";

export const dynamic = "force-dynamic";

/**
 * All lender-eligible accounts by Days Past Due — deliberately NOT filtered to `npa === true`.
 * `listAccounts` is the same call `/accounts` (and, by extension, everywhere else that needs
 * "every account this session can see") already makes — no second lender-scoping mechanism, no
 * second account model. This screen is a different lens on the exact same rows.
 */
export default async function DpdPage() {
  const session = await requireSession();
  const [accounts, claims] = await Promise.all([
    listAccounts(session),
    listClaims(session),
  ]);

  const byAccount = new Map(claims.map((c) => [c.accountId, c]));

  // No `a.npa || …` gate here — that's the one line that would turn this back into the NPA-only
  // claim grid. Every account this session can see is in scope; DPD is a filter on top, not an
  // eligibility rule underneath.
  const rows: EligibleRow[] = accounts.map((a) => {
    const claim = byAccount.get(a.id) ?? null;
    // Same claim-action mapping the Claim grid uses — unchanged, not re-derived here.
    const state = getClaimAction(a, claim);
    return { ...a, claim, claimAction: state.action, claimReason: state.reason };
  });

  return (
    <PortalShell activeKey="dpd" title="All Loans">
      <div className="space-y-4">
        <DpdClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
