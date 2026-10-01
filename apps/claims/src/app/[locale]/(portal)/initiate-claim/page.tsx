import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { listAccounts } from "@imgc/data/services/portal/accounts.server";
import {
  getClaimAction,
  listClaims,
} from "@imgc/data/services/portal/claimFlow.server";
import type { EligibleRow } from "@imgc/types/portal/eligibleClaim";

import { getAdminContextOrNull } from "@imgc/lib/auth/adminContext";
import { LenderContextBar } from "@imgc/features/portal/LenderContextBar";
import { listLenderOrgs } from "@imgc/data/services/portal/users.server";

// The Claims Overview band moved to the Claim Dashboard (/claim-dashboard); this page is the
// grid alone now.
export const dynamic = "force-dynamic";

export default async function InitiateClaimPage() {
  const session = await requireSession();
  const ctx = session.role === "IMGC" ? await getAdminContextOrNull() : null;
  // IMGC on this page without a lender chosen: send them to pick one first.
  const adminWithoutContext = session.role === "IMGC" && !ctx;

  const [accounts, claims, orgs] = await Promise.all([
    listAccounts(session),
    listClaims(session),
    session.role === "IMGC" ? listLenderOrgs() : Promise.resolve([]),
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
      let state = getClaimAction(a, claim);

      // IMGC works a claim here only if IMGC started it; a lender's own draft or query is theirs.
      if (
        session.role === "IMGC" &&
        state.action === "INITIATE" &&
        claim &&
        claim.fields.__initiatedByImgc !== "true"
      ) {
        state = { ...state, action: "TRACK" };
      }

      if (adminWithoutContext && state.action === "INITIATE") {
        state = {
          ...state,
          action: "DISABLED",
          reason: "Select a lender context to initiate or edit claims.",
        };
      }

      return {
        ...a,
        claim,
        claimAction: state.action,
        claimReason: state.reason,
      };
    })
    // Same population as the Claims tab for IMGC (it drops the same two closed-out statuses), so
    // the two tabs agree on the count; this one adds the lender context to initiate from. A claim
    // the lender raised themselves is only tracked from here, never edited — see the action above.
    .filter(
      (row) =>
        session.role !== "IMGC" ||
        (row.claimStatus !== "CLOSED" &&
          row.claimStatus !== "DOCUMENTS_RESUBMITTED")
    );

  return (
    <PortalShell activeKey="initiate-claim" title="">
      {session.role === "IMGC" && (
        <LenderContextBar orgs={orgs} currentOrgId={ctx?.lenderOrgId} />
      )}
      <EligibleCasesClient
        accounts={rows}
        trackView="single"
        showLender={session.role === "IMGC"}
      />
    </PortalShell>
  );
}
