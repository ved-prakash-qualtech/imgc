import { DashboardView } from "@/app/[locale]/(portal)/dashboard/DashboardView";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { sweepExpiredRejections } from "@/server/mock/retention";
import { listAccounts } from "@/services/portal/accounts.server";
import { buildDashboardSummary } from "@/services/portal/dashboard.server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  // Retention is time-based and there is no scheduler in the prototype, so the sweep runs on the
  // way in. A no-op unless something has actually aged out.
  await sweepExpiredRejections();

  const [, summary] = await Promise.all([
    listAccounts(session),
    buildDashboardSummary(session),
  ]);

  return (
    <PortalShell activeKey="dashboard" title="Dashboard">
      <DashboardView
        role={session.role}
        summary={summary}
      />
    </PortalShell>
  );
}
