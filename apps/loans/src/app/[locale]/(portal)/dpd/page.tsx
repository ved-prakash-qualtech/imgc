import { getTranslations } from "next-intl/server";
import { DpdClient } from "@/app/[locale]/(portal)/dpd/DpdClient";
import type { EligibleRow } from "@imgc/types/portal/eligibleClaim";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { listAccounts } from "@imgc/data/services/portal/accounts.server";
import {
  getClaimAction,
  listClaims,
} from "@imgc/data/services/portal/claimFlow.server";

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
    return {
      ...a,
      claim,
      claimAction: state.action,
      claimReason: state.reason,
    };
  });

  const tTitles = await getTranslations("shell.pageTitles");
  return (
    <PortalShell activeKey="dpd" title={tTitles("allLoans")}>
      <div className="space-y-4">
        <DpdClient accounts={rows} role={session.role} />
      </div>
    </PortalShell>
  );
}
