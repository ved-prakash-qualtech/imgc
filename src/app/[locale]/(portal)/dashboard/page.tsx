import { cookies } from "next/headers";

import { DashboardView } from "@/app/[locale]/(portal)/dashboard/DashboardView";
import { DASHBOARD_LENDER_COOKIE } from "@/app/[locale]/(portal)/dashboard/lenderPreference";
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

  // The lender IMGC last picked in the hero banner (see `getDashboardSummaryForLender`).
  // Validated against the real lender list below before it is trusted, and only ever read
  // for an IMGC session — a lender's own dashboard has no such lens.
  const rememberedLenderId =
    session.role === "IMGC"
      ? ((await cookies()).get(DASHBOARD_LENDER_COOKIE)?.value ?? null)
      : null;

  // Only IMGC's "every lender" hero banner has a lender dropdown to populate — same master
  // list of lender organisations IMGC already manages everywhere else (Lender Access, Claims,
  // All Loans), not a separate hard-coded subset.
  const lenderOrgs =
    session.role === "IMGC" ? await listLenderOrgs() : [];

  // Resolved before it scopes anything: a stale id (a lender since removed) falls back to
  // "every lender", rather than filtering the whole dashboard down to zero accounts while the
  // dropdown still reads "Every Lender".
  const initialLenderId =
    rememberedLenderId && lenderOrgs.some((o) => o.id === rememberedLenderId)
      ? rememberedLenderId
      : null;

  const [, summary] = await Promise.all([
    listAccounts(session),
    buildDashboardSummary(session, { lenderOrgId: initialLenderId }),
  ]);

  return (
    <PortalShell activeKey="dashboard" title="Dashboard">
      <DashboardView
        role={session.role}
        summary={summary}
        lenderOrgs={lenderOrgs}
        initialLenderId={initialLenderId}
      />
    </PortalShell>
  );
}
