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

  // A row exists here for every NPA account (new claims can only be raised on those) plus every
  // account that already carries a claim, NPA or not — a write-off-only account can't start a
  // fresh claim from this grid, but a claim already raised on one still needs to be tracked here,
  // since this is now the only place claims are tracked. Eligibility and the resulting action are
  // decided once here, in the service — no component re-derives it.
  const rows: EligibleRow[] = accounts
    .filter((a) => a.npa || byAccount.has(a.id))
    .map((a) => {
      const claim = byAccount.get(a.id) ?? null;
      const state = getClaimAction(a, claim);
      return { ...a, claim, claimAction: state.action, claimReason: state.reason };
    });

  return (
    <PortalShell activeKey="initiate-claim" title="Claim">
      <div className="space-y-4">
        <EligibleCasesClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
