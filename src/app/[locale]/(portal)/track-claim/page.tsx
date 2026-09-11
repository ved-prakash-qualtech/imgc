import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  listAccounts,
  type AccountRow,
} from "@/services/portal/accounts.server";
import {
  getClaimAction,
  listClaims,
  type ClaimRow,
} from "@/services/portal/claimFlow.server";
import type { ClaimAction } from "@/server/mock/types";

export const dynamic = "force-dynamic";

export interface EligibleRow extends AccountRow {
  claim: ClaimRow | null;
  claimAction: ClaimAction;
  claimReason?: string;
}

export default async function TrackClaimPage() {
  const session = await requireSession();
  const [accounts, claims] = await Promise.all([
    listAccounts(session),
    listClaims(session),
  ]);

  const byAccount = new Map(claims.map((c) => [c.accountId, c]));

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
    // Only include claims that can actually be tracked (submitted or decided).
    .filter((r) => r.claimAction === "TRACK" || r.claimAction === "VIEW");

  return (
    <PortalShell activeKey="track-claim" title="Track Claim">
      <EligibleCasesClient accounts={rows} trackView="single" />
    </PortalShell>
  );
}
