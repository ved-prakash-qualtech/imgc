import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { ClaimOverviewBand } from "@/components/portal/ClaimOverviewBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts, type AccountRow } from "@/services/portal/accounts.server";
import {
  getClaimAction,
  listClaims,
  summariseClaimOverview,
  type ClaimOverviewCounts,
  type ClaimRow,
} from "@/services/portal/claimFlow.server";
import type { ClaimAction } from "@/server/mock/types";

/** Each tile links to this same grid, pre-filtered to the exact bucket it counted — the grid
 *  reads the same `?status=` values back out via `statusFromParam` in EligibleCasesClient. */
const CLAIM_OVERVIEW_HREFS: Record<keyof ClaimOverviewCounts, string> = {
  total: ROUTES.initiateClaim,
  initiation: `${ROUTES.initiateClaim}?status=INITIATION`,
  underProgress: `${ROUTES.initiateClaim}?status=UNDER_PROGRESS`,
  approved: `${ROUTES.initiateClaim}?status=APPROVED`,
  rejected: `${ROUTES.initiateClaim}?status=REJECTED`,
  paid: `${ROUTES.initiateClaim}?status=CLOSED`,
};

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

  // Strictly DPD > 90 — not `a.npa`. The two happen to agree in this dataset (NPA is seeded as
  // DPD > 90), but the Claims tab's own eligibility rule is DPD-based, not NPA-based: an account
  // could in principle be flagged NPA for a reason other than DPD, and this tab must not show it
  // on that basis alone. `>` is deliberate — exactly 90 does not qualify, only 91+. A write-off
  // account's own claim (if it has one) is still tracked, just from the Accounts screen (`/dpd`),
  // which lists every account regardless of DPD; it no longer also appears here. Eligibility and
  // the resulting action are decided once here, in the service — no component re-derives it.
  const rows: EligibleRow[] = accounts
    .filter((a) => (a.dpd ?? 0) > 90)
    .map((a) => {
      const claim = byAccount.get(a.id) ?? null;
      const state = getClaimAction(a, claim);
      return { ...a, claim, claimAction: state.action, claimReason: state.reason };
    });

  return (
    <PortalShell activeKey="initiate-claim" title="Claim">
      <div className="space-y-4">
        <ClaimOverviewBand
          counts={summariseClaimOverview(rows)}
          hrefs={CLAIM_OVERVIEW_HREFS}
        />
        <EligibleCasesClient accounts={rows} />
      </div>
    </PortalShell>
  );
}
