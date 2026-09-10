import "server-only";

import { readDb } from "@/server/mock/db";
import {
  IN_PROGRESS_STATUSES,
  type ClaimDashboardData,
  type LenderProgressRow,
  type MonthlyPoint,
  type MonthWindow,
  type MonthlyStatusKey,
} from "@/services/portal/claimDashboard";
import type { AppSession } from "@/lib/auth/appSession";
import type { Claim } from "@/server/mock/types";

// Re-exported so `page.tsx` (a server component) has one import for both the data function and
// the option lists it validates search params against.
export {
  MONTH_WINDOWS,
  MONTHLY_STATUS_OPTIONS,
} from "@/services/portal/claimDashboard";
export type {
  ClaimDashboardData,
  MonthWindow,
  MonthlyStatusKey,
} from "@/services/portal/claimDashboard";

/**
 * The Claim Dashboard's two widgets, computed from the same Claim entities the Claims grid and
 * the Claims Overview band already read — no third status model. Both scope to the session (a
 * lender only ever sees its own claims) and, for an IMGC session, optionally narrow to one lender
 * org so the page's lender lens can drive both widgets at once.
 */

/** The account ids this session is allowed to see. */
function scopedAccountIds(
  accounts: ReadonlyArray<{ id: string; lenderOrgId: string }>,
  session: AppSession,
  lenderOrgId: string | null
): Set<string> {
  return new Set(
    accounts
      .filter((a) => {
        if (session.role !== "IMGC") return a.lenderOrgId === session.lenderOrgId;
        return lenderOrgId ? a.lenderOrgId === lenderOrgId : true;
      })
      .map((a) => a.id)
  );
}

/** The date a claim reached the given status — `null` if it never did. */
function reachedAt(claim: Claim, key: MonthlyStatusKey): string | null {
  if (key === "INITIATED") return claim.createdAt;
  const entry = claim.statusHistory.find((h) => h.status === key);
  return entry?.at ?? null;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The last `n` calendar months ending with the current one, oldest first. */
function lastMonths(n: number): { month: string; label: string }[] {
  const out: { month: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    out.push({
      month: `${d.getFullYear()}-${mm}`,
      label: MONTH_LABELS[d.getMonth()]!,
    });
  }
  return out;
}

export async function getClaimDashboard(
  session: AppSession,
  options: {
    lenderOrgId?: string | null;
    status?: MonthlyStatusKey;
    months?: MonthWindow;
  } = {}
): Promise<ClaimDashboardData> {
  const db = await readDb();
  const lenderOrgId =
    session.role === "IMGC" ? (options.lenderOrgId ?? null) : null;
  const status: MonthlyStatusKey = options.status ?? "INITIATED";
  const months: MonthWindow = options.months ?? 6;

  const ids = scopedAccountIds(db.accounts, session, lenderOrgId);
  // Same eligibility gate the Claims Overview band and the Claims grid apply: a claim only
  // counts once its account is DPD > 90. Without this the widgets counted every claim regardless
  // of DPD, so this page's "Under Progress" widget disagreed with the "Under Progress" tile in
  // the band directly above it (`summariseClaimOverview` over `dpd > 90` in page.tsx).
  const eligibleIds = new Set(
    db.accounts
      .filter((a) => ids.has(a.id) && (a.dpd ?? 0) > 90)
      .map((a) => a.id)
  );
  const claims = db.claims.filter((c) => eligibleIds.has(c.accountId));

  // ── Widget 1: month-on-month, how many claims reached `status` in each month ──
  const buckets = new Map<string, number>();
  for (const claim of claims) {
    const at = reachedAt(claim, status);
    if (!at) continue;
    const k = monthKey(at);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const monthly: MonthlyPoint[] = lastMonths(months).map((m) => ({
    month: m.month,
    label: m.label,
    count: buckets.get(m.month) ?? 0,
  }));

  // ── Widget 2: in-progress claims per lender, as of now ──
  const orgName = new Map(db.lenderOrgs.map((o) => [o.id, o.name] as const));
  const accountOrg = new Map(
    db.accounts.map((a) => [a.id, a.lenderOrgId] as const)
  );
  // Every lender org this session can see gets a row, even at zero, so the chart's set of bars is
  // stable rather than appearing and vanishing as claims move.
  const visibleOrgs =
    session.role === "IMGC"
      ? lenderOrgId
        ? db.lenderOrgs.filter((o) => o.id === lenderOrgId)
        : db.lenderOrgs
      : db.lenderOrgs.filter((o) => o.id === session.lenderOrgId);
  const perLender = new Map<string, { inProgress: number; total: number }>();
  for (const o of visibleOrgs) perLender.set(o.id, { inProgress: 0, total: 0 });

  for (const claim of claims) {
    const org = accountOrg.get(claim.accountId);
    if (!org) continue;
    const row = perLender.get(org);
    if (!row) continue;
    row.total += 1;
    if (IN_PROGRESS_STATUSES.has(claim.status)) row.inProgress += 1;
  }

  const byLender: LenderProgressRow[] = [...perLender.entries()]
    .map(([id, v]) => ({
      lenderOrgId: id,
      lenderName: orgName.get(id) ?? "—",
      inProgress: v.inProgress,
      total: v.total,
    }))
    .sort(
      (a, b) =>
        b.inProgress - a.inProgress || a.lenderName.localeCompare(b.lenderName)
    );

  return {
    monthly,
    byLender,
    canFilterByLender: session.role === "IMGC",
    lenders:
      session.role === "IMGC"
        ? db.lenderOrgs.map((o) => ({ id: o.id, name: o.name }))
        : [],
  };
}
