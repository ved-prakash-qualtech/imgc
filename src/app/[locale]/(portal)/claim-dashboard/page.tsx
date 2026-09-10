import { ClaimDashboardLenderPicker } from "@/app/[locale]/(portal)/claim-dashboard/ClaimDashboardLenderPicker";
import { ClaimDashboardView } from "@/app/[locale]/(portal)/claim-dashboard/ClaimDashboardView";
import { ClaimOverviewBand } from "@/components/portal/ClaimOverviewBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { getClaimDashboard } from "@/services/portal/claimDashboard.server";
import {
  MONTH_WINDOWS,
  MONTHLY_STATUS_OPTIONS,
  type MonthWindow,
  type MonthlyStatusKey,
} from "@/services/portal/claimDashboard";
import {
  listClaims,
  summariseClaimOverview,
  type ClaimOverviewCounts,
} from "@/services/portal/claimFlow.server";

export const dynamic = "force-dynamic";

/** Each band tile drills into the Claims grid, pre-filtered — the grid destination differs by
 *  role (IMGC's `/accounts`, the lender's own `/initiate-claim`), so it is resolved per session
 *  below rather than baked in here. */
function overviewHrefs(
  base: string
): Record<keyof ClaimOverviewCounts, string> {
  return {
    total: base,
    initiation: `${base}?status=${base === ROUTES.accounts ? "DRAFT" : "INITIATION"}`,
    underProgress: `${base}?status=UNDER_PROGRESS`,
    approved: `${base}?status=APPROVED`,
    rejected: `${base}?status=REJECTED`,
  };
}

function parseStatus(v: string | undefined): MonthlyStatusKey {
  return MONTHLY_STATUS_OPTIONS.some((o) => o.key === v)
    ? (v as MonthlyStatusKey)
    : "INITIATED";
}

function parseMonths(v: string | undefined): MonthWindow {
  const n = Number(v);
  return (MONTH_WINDOWS as readonly number[]).includes(n)
    ? (n as MonthWindow)
    : 6;
}

export default async function ClaimDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ lender?: string; status?: string; months?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const status = parseStatus(sp.status);
  const months = parseMonths(sp.months);

  const [accounts, claims, data] = await Promise.all([
    listAccounts(session),
    listClaims(session),
    getClaimDashboard(session, {
      lenderOrgId: sp.lender ?? null,
      status,
      months,
    }),
  ]);

  // A stale ?lender= (an org since removed, or a lender who arrived here by hand-editing the URL)
  // falls back to "all lenders" rather than a chart filtered to nothing.
  const lenderOrgId =
    session.role === "IMGC" && data.lenders.some((l) => l.id === sp.lender)
      ? (sp.lender ?? null)
      : null;

  // Same band the Claims grid used to show, over the same eligible-accounts set (`dpd > 90`) both
  // roles' Claims pages already filter to — `summariseClaimOverview` is the one classifier, so
  // the band here and the grid there can never disagree.
  const claimByAccountId = new Map(claims.map((c) => [c.accountId, c]));
  const eligible = accounts
    .filter((a) => (a.dpd ?? 0) > 90)
    .map((a) => ({ claim: claimByAccountId.get(a.id) ?? null }));
  const counts = summariseClaimOverview(eligible);
  const lenderCounts =
    session.role === "LENDER"
      ? {
          ...counts,
          underProgress: eligible.filter(
            ({ claim }) => claim?.status === "QUERY_RAISED"
          ).length,
        }
      : counts;

  const gridBase =
    session.role === "IMGC" ? ROUTES.accounts : ROUTES.initiateClaim;

  const selectedLenderName =
    data.lenders.find((l) => l.id === lenderOrgId)?.name ?? null;

  return (
    <PortalShell activeKey="claim-dashboard" title="Claim Dashboard">
      <div className="space-y-4">
        <ClaimOverviewBand
          counts={lenderCounts}
          hrefs={overviewHrefs(gridBase)}
          title={
            data.canFilterByLender
              ? (selectedLenderName ?? "Every Lender")
              : "Claims Overview"
          }
          action={
            data.canFilterByLender ? (
              <ClaimDashboardLenderPicker
                lenders={data.lenders}
                value={lenderOrgId}
              />
            ) : undefined
          }
        />
        <ClaimDashboardView
          data={data}
          status={status}
          months={months}
          lenderOrgId={lenderOrgId}
        />
      </div>
    </PortalShell>
  );
}
