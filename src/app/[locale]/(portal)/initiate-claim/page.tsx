import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts, type AccountRow } from "@/services/portal/accounts.server";
import { listClaims, type ClaimRow } from "@/services/portal/claimFlow.server";

export const dynamic = "force-dynamic";

/** One grid row: an NPA account plus whatever claim it already carries. */
export interface EligibleRow extends AccountRow {
  claim: ClaimRow | null;
}

export default async function InitiateClaimPage() {
  const session = await requireSession();
  const [accounts, claims] = await Promise.all([
    listAccounts(session),
    listClaims(session),
  ]);

  const byAccount = new Map(claims.map((c) => [c.accountId, c]));

  // NPA-only: the grid is for raising claims on non-performing accounts. A claim that exists on
  // a write-off-only account is still reachable from Track & Query Response.
  const rows: EligibleRow[] = accounts
    .filter((a) => a.npa)
    .map((a) => ({ ...a, claim: byAccount.get(a.id) ?? null }));

  return (
    <PortalShell activeKey="initiate-claim" title="Initiate Claim">
      <div className="space-y-6">
        <EligibleCasesClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
