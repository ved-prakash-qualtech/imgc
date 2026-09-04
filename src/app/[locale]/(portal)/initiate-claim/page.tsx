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

/** One grid row: the account, whatever claim it already has, and what may be done next. */
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

  // Eligibility is decided once, in the service, and carried on the row — no component
  // re-derives it from npa/writeOff.
  const rows: EligibleRow[] = accounts
    .map((a) => {
      const claim = byAccount.get(a.id) ?? null;
      const state = getClaimAction(a, claim);
      return {
        ...a,
        claim,
        claimAction: state.action,
        claimReason: state.reason,
      };
    })
    .filter((r) => r.npa || r.writeOff || r.claim);

  return (
    <PortalShell activeKey="initiate-claim" title="Initiate Claim">
      <div className="space-y-6">
        <EligibleCasesClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
