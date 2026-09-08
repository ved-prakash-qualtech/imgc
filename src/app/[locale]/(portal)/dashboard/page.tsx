import { DashboardView } from "@/app/[locale]/(portal)/dashboard/DashboardView";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { sweepExpiredRejections } from "@/server/mock/retention";
import { listAccounts } from "@/services/portal/accounts.server";
import { buildDashboardSummary } from "@/services/portal/dashboard.server";
import { listLenderOrgs } from "@/services/portal/users.server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  // Retention is time-based and there is no scheduler in the prototype, so the sweep runs on the
  // way in. A no-op unless something has actually aged out.
  await sweepExpiredRejections();

  const [, summary, lenderOrgs] = await Promise.all([
    listAccounts(session),
    buildDashboardSummary(session),
    // Only IMGC's "every lender" hero banner has a lender dropdown to populate — same master list
    // of lender organisations IMGC already manages everywhere else (Lender Access, Claims, All
    // Loans), not a separate hard-coded subset.
    session.role === "IMGC" ? listLenderOrgs() : Promise.resolve([]),
  ]);

  return (
    <PortalShell activeKey="dashboard" title="Dashboard">
      <DashboardView
        role={session.role}
        summary={summary}
        lenderOrgs={lenderOrgs}
      />
    </PortalShell>
  );
}
