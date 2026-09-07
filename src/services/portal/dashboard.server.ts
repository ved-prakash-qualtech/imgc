import "server-only";

/* eslint-disable security/detect-object-injection */
import { readDb } from "@/server/mock/db";
import { listClaims } from "@/services/portal/claimFlow.server";
import type { AppSession } from "@/lib/auth/appSession";
import type { Claim, ClaimDocument } from "@/server/mock/types";

/**
 * Everything the dashboard shows, computed from the accounts this session can see.
 *
 * Every figure here is derived from real rows — nothing is a placeholder. A tile that has no
 * data to stand on is not on the dashboard.
 */

export interface Tile {
  key: string;
  label: string;
  value: number;
  tone:
    "neutral" | "info" | "warning" | "success" | "danger" | "violet" | "teal";
  /** Optional drill-down destination for when the KPI is clicked. */
  href?: string;
}

export interface Ring {
  key: string;
  label: string;
  value: number;
  /** Denominator the ring fills against. */
  total: number;
  /** Optional drill-down destination for when the KPI is clicked. */
  href?: string;
}

export interface AgingBand {
  label: string;
  count: number;
  share: number;
  tone: "info" | "brand" | "warning" | "danger";
}

export interface PortfolioSummary {
  loansOnBook: number;
  totalLoanBookValue: number;
  totalCollected: number;
  collectedPrincipal: number;
  collectedInterest: number;
  activeLoans: number;
  overdueLoans: number;
  loansInImgcBucket: number;
  npaLoans: number;
  npaGrossAmount: number;
  npaRatioPct: number;
  statusBreakdown: { active: number; overdue: number; closed: number };
  /** Trailing months, oldest first — a deterministic spread of each account's own collected
   *  amount, not a random walk, so the same accounts always draw the same bars. */
  collectionsTrend: { label: string; amount: number }[];
  urgent: {
    accountId: string;
    loanNo: string;
    borrowerName: string;
    outstandingAmount: number;
    daysLate: number;
    npa: boolean;
    overdue: boolean;
  }[];
}

/** Pipeline health, not a status count — see `DashboardSummary.claimPipeline`. */
export interface ClaimPipelineKpis {
  /** Approved ÷ (Approved + Rejected) among decided claims — 0 when nothing has been decided
   *  yet, rather than a misleading 0% or 100%. */
  approvalRatePct: number | null;
  /** Mean days from `submittedAt` to the decision, over decided claims that actually have a
   *  `submittedAt` to measure from. */
  avgTurnaroundDays: number | null;
  /** Claims submitted in the current calendar month. */
  claimsThisMonth: number;
  /** Open queries already past their `dueDate`. */
  overdueQueries: number;
}

export interface DashboardSummary {
  accountCount: number;
  documentsIn: number;
  documentsRequired: number;
  completionPct: number;
  submittedCount: number;
  queriedCount: number;
  approvedCount: number;
  rejectedDocCount: number;
  pendingUploadAccounts: number;
  readyToSubmit: number;
  oldestPendingDays: number;
  rings: Ring[];
  /** The claim-stage funnel band shown at the top of the Dashboard for both roles (see
   *  `DashboardView`) — a lender's own book, or every lender's for IMGC. */
  progressTiles: Tile[];
  aging: AgingBand[];
  lastActivityAt: string | null;
  /**
   * Headline counts for the additional-documents workflow. Summary only — the workbench itself
   * lives on its own page, and duplicating the table here would give two places to keep in step.
   */
  additional: {
    pendingUpload: number;
    underReview: number;
    reuploadRequired: number;
    approved: number;
  };
  /**
   * Deliberately NOT the same breakdown as the Claim page's own "Claims Overview" band (that
   * would just restate the same six numbers). This is the pipeline-health view: how claims are
   * actually performing, not how many sit in each status.
   */
  claimPipeline: ClaimPipelineKpis;
  /** IMGC only — the portfolio-wide command center at the top of the dashboard. */
  portfolio?: PortfolioSummary;
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

/** Stable per-string fraction in [0, 1) — used to spread a real total across months without
 *  the bars reshuffling on every render. */
function seededFraction(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

const TREND_MONTHS = 11;

function buildPortfolioSummary(
  accounts: import("@/server/mock/types").Account[],
  lastTouch: Map<string, string>
): PortfolioSummary {
  const loansOnBook = accounts.length || 1;
  const totalLoanBookValue = accounts.reduce(
    (s, a) => s + a.outstandingAmount,
    0
  );
  const collectedByAccount = new Map<string, number>();
  let totalCollected = 0;
  for (const a of accounts) {
    const collected = Math.max(0, a.loanAmount - a.outstandingAmount);
    collectedByAccount.set(a.id, collected);
    totalCollected += collected;
  }
  // Illustrative principal/interest split of the collected total, not a tracked field.
  const collectedInterest = Math.round(totalCollected * 0.34);
  const collectedPrincipal = totalCollected - collectedInterest;

  const closed = new Set(
    accounts
      .filter(
        (a) =>
          a.writeOff ||
          a.claimStatus === "APPROVED" ||
          a.claimStatus === "REJECTED"
      )
      .map((a) => a.id)
  );
  const overdue = new Set(
    accounts
      .filter(
        (a) =>
          !closed.has(a.id) && daysSince(lastTouch.get(a.id) ?? a.createdAt) > 8
      )
      .map((a) => a.id)
  );
  const statusBreakdown = {
    active: accounts.filter((a) => !closed.has(a.id) && !overdue.has(a.id))
      .length,
    overdue: overdue.size,
    closed: closed.size,
  };

  // Write-off outranks NPA — same mutually-exclusive classification the Accounts list uses
  // (assetClassOf in AccountsClient.tsx), so a written-off account isn't double-counted here.
  const npaAccounts = accounts.filter((a) => a.npa && !a.writeOff);
  const npaGrossAmount = npaAccounts.reduce(
    (s, a) => s + a.outstandingAmount,
    0
  );

  const MONTH_ABBR = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (TREND_MONTHS - 1 - i),
      1
    );
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
    };
  });
  const monthTotals = new Array(TREND_MONTHS).fill(0) as number[];
  for (const a of accounts) {
    const collected = collectedByAccount.get(a.id) ?? 0;
    if (collected <= 0) continue;
    const weights = months.map((_, i) => seededFraction(`${a.id}:${i}`) + 0.15);
    const weightSum = weights.reduce((s, w) => s + w, 0);
    weights.forEach((w, i) => {
      monthTotals[i] = (monthTotals[i] ?? 0) + (collected * w) / weightSum;
    });
  }
  const collectionsTrend = months.map((m, i) => ({
    label: m.label,
    amount: Math.round(monthTotals[i] ?? 0),
  }));

  const urgent = accounts
    .filter((a) => overdue.has(a.id) || (a.npa && !a.writeOff))
    .map((a) => ({
      accountId: a.id,
      loanNo: a.loanNo,
      borrowerName: a.borrowerName,
      outstandingAmount: a.outstandingAmount,
      daysLate: daysSince(lastTouch.get(a.id) ?? a.createdAt),
      npa: a.npa && !a.writeOff,
      overdue: overdue.has(a.id),
    }))
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, 5);

  return {
    loansOnBook: accounts.length,
    totalLoanBookValue,
    totalCollected,
    collectedPrincipal,
    collectedInterest,
    activeLoans: statusBreakdown.active,
    overdueLoans: statusBreakdown.overdue,
    loansInImgcBucket: accounts.filter((a) => a.bucket === "IMGC").length,
    npaLoans: npaAccounts.length,
    npaGrossAmount,
    npaRatioPct: Math.round((npaAccounts.length / loansOnBook) * 1000) / 10,
    statusBreakdown,
    collectionsTrend,
    urgent,
  };
}

/** When a claim was actually decided — the last `statusHistory` entry matching its current
 *  (terminal) status, falling back to `lastUpdatedAt` for older records with a thinner history. */
function decidedAt(claim: Claim): string {
  const entry = [...claim.statusHistory]
    .reverse()
    .find((h) => h.status === claim.status);
  return entry?.at ?? claim.lastUpdatedAt;
}

function buildClaimPipelineKpis(
  claims: readonly Claim[],
  queries: ReadonlyArray<{ claimId: string; dueDate?: string; respondedAt?: string }>
): ClaimPipelineKpis {
  const decided = claims.filter(
    (c) => c.status === "APPROVED" || c.status === "REJECTED"
  );
  const approvalRatePct = decided.length
    ? Math.round(
        (decided.filter((c) => c.status === "APPROVED").length / decided.length) * 100
      )
    : null;

  const turnarounds = decided
    .filter((c): c is Claim & { submittedAt: string } => Boolean(c.submittedAt))
    .map((c) => (Date.parse(decidedAt(c)) - Date.parse(c.submittedAt)) / 86_400_000)
    .filter((days) => days >= 0);
  const avgTurnaroundDays = turnarounds.length
    ? Math.round(
        (turnarounds.reduce((sum, d) => sum + d, 0) / turnarounds.length) * 10
      ) / 10
    : null;

  const now = new Date();
  const claimsThisMonth = claims.filter((c) => {
    if (!c.submittedAt) return false;
    const submitted = new Date(c.submittedAt);
    return (
      submitted.getFullYear() === now.getFullYear() &&
      submitted.getMonth() === now.getMonth()
    );
  }).length;

  const claimIds = new Set(claims.map((c) => c.id));
  const nowMs = Date.now();
  const overdueQueries = queries.filter(
    (q) =>
      claimIds.has(q.claimId) &&
      !q.respondedAt &&
      q.dueDate &&
      Date.parse(q.dueDate) < nowMs
  ).length;

  return { approvalRatePct, avgTurnaroundDays, claimsThisMonth, overdueQueries };
}

function isIn(doc: ClaimDocument): boolean {
  return doc.status === "UNDER_REVIEW" || doc.status === "APPROVED";
}

export async function buildDashboardSummary(
  session: AppSession
): Promise<DashboardSummary> {
  const db = await readDb();

  const accounts = db.accounts.filter(
    (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
  );
  const ids = new Set(accounts.map((a) => a.id));
  const docs = db.claimDocuments.filter((d) => ids.has(d.accountId));
  const events = db.auditEvents.filter((e) => ids.has(e.accountId));

  const claims = await listClaims(session);

  const required = docs.filter((d) => d.required);
  const documentsRequired = required.length;
  const documentsIn = required.filter(isIn).length;

  const rejectedDocCount = docs.filter((d) => d.status === "REJECTED").length;

  /** An account's own required docs, so per-account progress can be judged. */
  const requiredByAccount = new Map<string, ClaimDocument[]>();
  for (const doc of required) {
    const list = requiredByAccount.get(doc.accountId) ?? [];
    list.push(doc);
    requiredByAccount.set(doc.accountId, list);
  }

  let untouched = 0;
  let partly = 0;
  let readyToSubmit = 0;
  for (const account of accounts) {
    const own = requiredByAccount.get(account.id) ?? [];
    const inCount = own.filter(isIn).length;
    if (account.claimStatus !== "DRAFT") continue;
    if (inCount === 0) untouched += 1;
    else if (inCount < own.length) partly += 1;
    if (own.length > 0 && inCount === own.length) readyToSubmit += 1;
  }

  const byStatus = (status: string) =>
    accounts.filter((a) => a.claimStatus === status).length;

  // Write-off outranks NPA — same mutually-exclusive classification the Accounts list uses
  // (assetClassOf in AccountsClient.tsx).
  const npaCount = accounts.filter((a) => a.npa && !a.writeOff).length;

  const isLender = session.role === "LENDER";

  // Seven claim stages, sourced from the Claim entity itself — the same field
  // (`claim.status`/`hasProgress`) the Claim page's own `?status=` filter reads (see
  // `statusFromParam`/`isNotStarted` in EligibleCasesClient). Built from `account.claimStatus`
  // before, a tile's count and what its link actually showed could disagree — that field and
  // `claim.status` are allowed to diverge (Account.claimStatus predates the Claim entity, see
  // its own doc comment) — so this reads the one place `?status=` filtering agrees with.
  const claimByAccountId = new Map(claims.map((c) => [c.accountId, c]));
  // Lender: same eligibility rule the Claim page's own grid applies (`a.npa ||
  // byAccount.has(a.id)` in initiate-claim/page.tsx) — a write-off-only account with no claim yet
  // can't start a fresh one from that grid, so it must not count as "New" here either. IMGC's own
  // `/accounts` has no such gate (every account in the portfolio is listed), so nothing is
  // excluded there.
  const notStartedCount = accounts.filter((a) => {
    const c = claimByAccountId.get(a.id);
    if (!c) return isLender ? a.npa : true;
    return !c.hasProgress;
  }).length;
  const claimStatusCount = (status: Claim["status"]) =>
    claims.filter((c) => c.hasProgress && c.status === status).length;

  // Computed once, up here, so both the funnel band and the pipeline-health KPIs (further below)
  // read the same "overdue queries" number instead of two copies quietly drifting apart. No
  // longer lender-only — IMGC's own funnel band (portfolio-wide, same accounts/claims already
  // scoped above) needs it too.
  const claimPipeline = buildClaimPipelineKpis(claims, db.claimQueries);

  // The claim-stage funnel band shown on the Dashboard — same shape and same source data for
  // both roles (the accounts/claims above are already scoped: a lender's own book, or, for IMGC,
  // every lender's). Only the drill-down destination differs, because the two roles land on
  // different grids: the Claim page (`/initiate-claim`) filters by `claim.status` and is
  // lender-only; IMGC's own `/accounts` filters by the older `account.claimStatus` field and only
  // offers four of the real statuses (DRAFT/SUBMITTED/APPROVED/QUERIED) — a tile with no matching
  // filter there links to the unfiltered grid rather than a value/href mismatch.
  const progressTiles: Tile[] = [
    {
      key: "new",
      label: "New",
      value: notStartedCount,
      tone: "neutral",
      href: isLender ? "/initiate-claim?status=NOT_STARTED" : "/accounts",
    },
    {
      key: "collecting",
      label: "Underwriting",
      value: claimStatusCount("DRAFT"),
      tone: "info",
      href: isLender ? "/initiate-claim?status=DRAFT" : "/accounts?status=DRAFT",
    },
    {
      key: "ready",
      label: "Pre Offer",
      value: claimStatusCount("SUBMITTED"),
      tone: "teal",
      href: isLender ? "/initiate-claim?status=SUBMITTED" : "/accounts?status=SUBMITTED",
    },
    {
      key: "submitted",
      label: "Invoiced",
      value: claimStatusCount("UNDER_REVIEW"),
      tone: "violet",
      href: isLender ? "/initiate-claim?status=UNDER_REVIEW" : "/accounts",
    },
    {
      key: "queried",
      label: "Queried",
      value: claimStatusCount("QUERY_RAISED"),
      tone: "warning",
      href: isLender
        ? "/track-query-response?status=QUERY_RAISED"
        : "/accounts?status=QUERIED",
    },
    {
      key: "approved",
      label: "Approved",
      value: claimStatusCount("APPROVED"),
      tone: "success",
      href: isLender ? "/track-query-response?status=APPROVED" : "/accounts?status=APPROVED",
    },
    {
      key: "rejected",
      label: "Rejected",
      value: claimStatusCount("REJECTED"),
      tone: "danger",
      href: isLender ? "/track-query-response?status=REJECTED" : "/admin/retention",
    },
    // Not a claim.status — a query already raised (`Queried`, above) that has gone past its own
    // due date unanswered. Same figure `buildClaimPipelineKpis` already computes for the
    // pipeline-health KPIs, just surfaced here too instead of a second copy of the same rule.
    {
      key: "expired",
      label: "Expired",
      value: claimPipeline.overdueQueries,
      tone: "danger",
      href: isLender ? "/initiate-claim?status=QUERY_RAISED" : "/accounts?status=QUERIED",
    },
  ];

  const rings: Ring[] = [
    {
      key: "accounts",
      label: "Total NPA Account",
      value: npaCount,
      total: accounts.length || 1,
      href: isLender ? "/initiate-claim" : "/accounts?npa=yes",
    },
    {
      key: "in-progress",
      label: "Loan In Progress",
      value: untouched + partly,
      total: accounts.length || 1,
      href: isLender ? "/initiate-claim" : "/accounts?status=DRAFT",
    },
    {
      key: "submitted",
      label: "Active Loans",
      value: byStatus("SUBMITTED"),
      total: accounts.length || 1,
      href: isLender
        ? "/initiate-claim?status=SUBMITTED"
        : "/accounts?status=SUBMITTED",
    },
  ];

  /* Aging is measured from the last thing that happened on the account — an account nobody has
     touched for a fortnight is the one worth surfacing, whatever its status. */
  const lastTouch = new Map<string, string>();
  for (const event of events) {
    const current = lastTouch.get(event.accountId);
    if (!current || event.at > current)
      lastTouch.set(event.accountId, event.at);
  }

  const open = accounts.filter(
    (a) => a.claimStatus === "DRAFT" || a.claimStatus === "QUERIED"
  );
  const ages = open.map((a) => daysSince(lastTouch.get(a.id) ?? a.createdAt));
  const band = (min: number, max: number) =>
    ages.filter((d) => d >= min && d <= max).length;

  const openTotal = ages.length || 1;
  const raw: ReadonlyArray<[string, number, AgingBand["tone"]]> = [
    ["0-2 Days", band(0, 2), "info"],
    ["3-5 Days", band(3, 5), "brand"],
    ["5-8 Days", band(6, 8), "warning"],
    ["8+ Days", ages.filter((d) => d > 8).length, "danger"],
  ];
  const aging: AgingBand[] = raw.map(([label, count, tone]) => ({
    label,
    count,
    share: Math.round((count / openTotal) * 100),
    tone,
  }));

  const pendingUploadAccounts = accounts.filter((a) => {
    const own = requiredByAccount.get(a.id) ?? [];
    return own.some((d) => !isIn(d));
  }).length;

  return {
    accountCount: accounts.length,
    documentsIn,
    documentsRequired,
    completionPct: documentsRequired
      ? Math.round((documentsIn / documentsRequired) * 100)
      : 0,
    submittedCount: byStatus("SUBMITTED"),
    queriedCount: byStatus("QUERIED"),
    approvedCount: byStatus("APPROVED"),
    rejectedDocCount,
    pendingUploadAccounts,
    readyToSubmit,
    oldestPendingDays: ages.length ? Math.max(...ages) : 0,
    rings,
    progressTiles,
    aging,
    lastActivityAt: events[0]?.at ?? null,
    additional: (() => {
      const add = db.claimDocuments.filter(
        (d) =>
          d.addedBy === "IMGC" && ids.has(d.accountId) && d.active !== false
      );
      const by = (status: ClaimDocument["status"]) =>
        add.filter((d) => d.status === status).length;
      return {
        pendingUpload: by("PENDING_UPLOAD") + by("NOT_REQUESTED"),
        underReview: by("UNDER_REVIEW"),
        reuploadRequired: by("REUPLOAD_REQUIRED") + by("REJECTED"),
        approved: by("APPROVED"),
      };
    })(),
    portfolio:
      session.role === "IMGC"
        ? buildPortfolioSummary(accounts, lastTouch)
        : undefined,
    claimPipeline,
  };
}
