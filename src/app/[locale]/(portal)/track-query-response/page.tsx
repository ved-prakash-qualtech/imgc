import { TrackCasesClient } from "@/app/[locale]/(portal)/track-query-response/TrackCasesClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listClaims } from "@/services/portal/claimFlow.server";

export const dynamic = "force-dynamic";

/**
 * Track Claim.
 *
 * Driven by claims rather than accounts: a query is raised against a claim, so a page reading
 * `account.claimStatus` would show nothing when one arrives. Drafts are excluded — there is
 * nothing to track until a claim has been submitted. Query response lives inside each claim's
 * own Track Claim page (`/claims/[claimId]`), not as a separate primary page.
 */
export default async function TrackClaimPage() {
  const session = await requireSession();
  const claims = await listClaims(session);
  const tracked = claims.filter((c) => c.status !== "DRAFT");

  return (
    <PortalShell activeKey="track-query-response" title="Track Claim">
      <TrackCasesClient claims={tracked} isLender={session.role === "LENDER"} />
    </PortalShell>
  );
}
