/* eslint-disable react-perf/jsx-no-jsx-as-prop */
import { claimAmountFor } from "@imgc/config/claimConfig";
import { OverviewTotals } from "@imgc/features/portal/OverviewTotals";
import { ClaimDashboardLenderPicker } from "@/app/[locale]/(portal)/claim-dashboard/ClaimDashboardLenderPicker";
import { ClaimDashboardView } from "@/app/[locale]/(portal)/claim-dashboard/ClaimDashboardView";
import { ClaimOverviewBand } from "@imgc/features/portal/ClaimOverviewBand";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { ROUTES } from "@imgc/constants/route";
import { getTranslations } from "next-intl/server";

import { requireSession } from "@imgc/lib/auth/appSession";
import { listAccounts } from "@imgc/data/services/portal/accounts.server";
import { getClaimDashboard } from "@imgc/data/services/portal/claimDashboard.server";
import {
  MONTH_WINDOWS,
  MONTHLY_STATUS_OPTIONS,
  type MonthWindow,
  type MonthlyStatusKey,
} from "@imgc/data/services/portal/claimDashboard";
import {
  listClaims,
  summariseClaimOverview,
  type ClaimOverviewCounts,
} from "@imgc/data/services/portal/claimFlow.server";
import type { ClaimStatus } from "@imgc/types/domain";

export const dynamic = "force-dynamic";

/** Each band tile drills into the Claims grid, pre-filtered — the grid destination differs by
 *  role (IMGC's `/accounts`, the lender's own `/initiate-claim`), so it is resolved per session
 *  below rather than baked in here. */
function overviewHrefs(
  base: string,
  lenderOrgId: string | null
): Partial<Record<keyof ClaimOverviewCounts, string>> {
  // The tiles count only the lender picked in the hero banner, so the grid they open is narrowed
  // to that lender too — otherwise "14" for one lender opens a grid of every lender's rows.
  const lender = lenderOrgId
    ? `&lender=${encodeURIComponent(lenderOrgId)}`
    : "";
  const href = (status: string) => `${base}?status=${status}${lender}`;
  return {
    total:
      base === ROUTES.initiateClaim
        ? href(
            "NOT_STARTED,UNDER_REVIEW,QUERY_INITIATED,QUERY_UNDER_REVIEW,INITIATED"
          )
        : href(
            "NOT_STARTED,UNDER_REVIEW,DOCUMENTS_RESUBMITTED,QUERY_INITIATED,QUERY_UNDER_REVIEW,INITIATED"
          ),
    initiation: href("NOT_STARTED"),
    underReview: href("UNDER_REVIEW"),
    approved: href("APPROVED"),
    rejected: href("REJECTED"),
    draft: href("DRAFT"),
    initiated: href("INITIATED"),
    queried: href("QUERY_INITIATED,QUERY_UNDER_REVIEW"),
    refunded: href("REFUND_RECEIVED_BY_IMGC"),
  };
}

function parseStatus(v: string | undefined): MonthlyStatusKey {
  return MONTHLY_STATUS_OPTIONS.some((o) => o.key === v)
    ? (v as MonthlyStatusKey)
    : "APPROVED";
}

function parseMonths(v: string | undefined): MonthWindow {
  const n = Number(v);
  return (MONTH_WINDOWS as readonly number[]).includes(n)
    ? (n as MonthWindow)
    : 3;
}

export default async function ClaimDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ lender?: string; status?: string; months?: string }>;
}) {
  const session = await requireSession();
  const t = await getTranslations("dashboard");
  const sp = await searchParams;

  // The dashboard is IMGC's own view of every lender, whichever lender they happen to be
  // initiating a claim for on the Claim by IMGC screen. Its own picker is what narrows it.

  const status = parseStatus(sp.status);
  const months = parseMonths(sp.months);

  const [accounts, claims, data] = await Promise.all([
    listAccounts(session, { ignoreLenderContext: true }),
    listClaims(session, { ignoreLenderContext: true }),
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
  // the band here and the grid there can never disagree. Narrowed to the hero-banner's selected
  // lender when one is picked, so the tiles track the dropdown the same way the widgets do.
  const claimByAccountId = new Map(claims.map((c) => [c.accountId, c]));
  const inScope = accounts
    .filter((a) => (a.dpd ?? 0) > 90)
    .filter((a) => !lenderOrgId || a.lenderOrgId === lenderOrgId)
    // The Lender's own Claims grid deliberately hides `DOCUMENTS_RESUBMITTED` and `CLOSED`
    // claims (they've moved on to a different screen/workflow) — dropped here too, so a tile
    // click never lands on a grid showing fewer rows than the tile counted.
    .filter((a) => {
      // IMGC's Claims grid (accounts/page.tsx) hides the same two, by the account's own status —
      // counting them here made a tile read higher than the grid it opens.
      if (session.role === "IMGC") {
        return (
          a.claimStatus !== "DOCUMENTS_RESUBMITTED" &&
          a.claimStatus !== "CLOSED"
        );
      }
      const claimStatus = claimByAccountId.get(a.id)?.status;
      return (
        claimStatus !== "DOCUMENTS_RESUBMITTED" && claimStatus !== "CLOSED"
      );
    });
  // Totals over exactly the accounts the tiles count, so the header and the tiles agree.
  const totals = {
    loan: inScope.reduce((n, a) => n + a.loanAmount, 0),
    outstanding: inScope.reduce((n, a) => n + a.outstandingAmount, 0),
    claim: inScope.reduce((n, a) => n + claimAmountFor(a.loanAmount), 0),
  };
  const eligible = inScope.map((a) => {
    if (session.role !== "IMGC") {
      const claim = claimByAccountId.get(a.id);
      return {
        claim: claim
          ? { status: claim.status, hasProgress: claim.hasProgress }
          : null,
        claimAmount: claimAmountFor(a.loanAmount),
      };
    }

    const status = a.realClaimStatus ?? a.claimStatus;
    return {
      claim: {
        status: status as ClaimStatus,
        hasProgress: a.claimHasProgress,
      },
      claimAmount: claimAmountFor(a.loanAmount),
    };
  });
  const counts = summariseClaimOverview(eligible);

  // IMGC's tiles drill into their own claims grid; the lender's into theirs.
  const gridBase =
    session.role === "IMGC" ? ROUTES.accounts : ROUTES.initiateClaim;

  const selectedLenderName =
    data.lenders.find((l) => l.id === lenderOrgId)?.name ?? null;

  const tTitles = await getTranslations("shell.pageTitles");
  return (
    <PortalShell activeKey="claim-dashboard" title={tTitles("claimDashboard")}>
      <div className="space-y-4">
        <ClaimOverviewBand
          counts={counts}
          role={session.role}
          hrefs={overviewHrefs(gridBase, lenderOrgId)}
          showDraftQueryKpis
          title={
            data.canFilterByLender
              ? (selectedLenderName ?? t("everyLender"))
              : t("overview")
          }
          // Left, beside "Overview": the total claim amount, and the approved and rejected shares
          // of it - the latter two from the same buckets the Approved and Rejected tiles count.
          titleAside={
            <OverviewTotals
              total={totals.claim}
              approved={counts.claimAmount.approved}
              rejected={counts.claimAmount.rejected}
            />
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
