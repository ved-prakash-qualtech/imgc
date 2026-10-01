import { EligibleCasesClient } from "@/app/[locale]/(portal)/initiate-claim/EligibleCasesClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { getClaimAction, listClaims } from "@/services/portal/claimFlow.server";
import type { EligibleRow } from "@/types/portal/eligibleClaim";

import { getAdminContextOrNull } from "@/lib/auth/adminContext";
import { LenderContextBar } from "@/components/portal/LenderContextBar";
import { listLenderOrgs } from "@/services/portal/users.server";

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
    // Claim by IMGC is IMGC's own workspace: accounts still to be initiated, and the claims IMGC
    // started for this lender. A claim the lender raised themselves is theirs to work — IMGC
    // reviews it from the Claims tab, not from here.
    .filter(
      (row) =>
        session.role !== "IMGC" ||
        !row.claim ||
        row.claim.fields.__initiatedByImgc === "true"
    );

  return (
    <PortalShell activeKey="initiate-claim" title="">
      {session.role === "IMGC" && (
        <LenderContextBar orgs={orgs} currentOrgId={ctx?.lenderOrgId} />
      )}
      <EligibleCasesClient accounts={rows} trackView="single" />
    </PortalShell>
  );
}
