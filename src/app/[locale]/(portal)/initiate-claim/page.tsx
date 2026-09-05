import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts, type AccountRow } from "@/services/portal/accounts.server";
import {
  getClaimAction,
  listClaims,
  type ClaimRow,
} from "@/services/portal/claimFlow.server";
import type { ClaimAction } from "@/server/mock/types";

export const dynamic = "force-dynamic";

/** One grid row: an NPA account, whatever claim it carries, and what the row may do next. */
export interface EligibleRow extends AccountRow {
  claim: ClaimRow | null;
  claimAction: ClaimAction;
  claimReason?: string;
}

export default async function InitiateClaimPage() {
  const session = await requireSession();
  const [accounts, claims] = await Promise.all([
    listAccounts(session),
    listClaims(session),
  ]);

  const byAccount = new Map(claims.map((c) => [c.accountId, c]));

  // NPA-only: the grid is for raising claims on non-performing accounts. A claim that exists on
  // a write-off-only account is still reachable from Track & Query Response. Eligibility and the
  // resulting action are decided once here, in the service — no component re-derives it.
  const rows: EligibleRow[] = accounts
    .filter((a) => a.npa)
    .map((a) => {
      const claim = byAccount.get(a.id) ?? null;
      const state = getClaimAction(a, claim);
      return { ...a, claim, claimAction: state.action, claimReason: state.reason };
    });

  return (
    <PortalShell activeKey="initiate-claim" title="Initiate Claim">
      <div className="space-y-6">
        <EligibleCasesClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
