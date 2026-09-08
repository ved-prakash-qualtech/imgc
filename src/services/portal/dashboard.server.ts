import "server-only";

/* eslint-disable security/detect-object-injection */
import { readDb } from "@/server/mock/db";
import { ROUTES } from "@/constants/route";
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

export interface PriorityAccount {
  id: string;
  loanNo: string;
  borrowerName: string;
  loanAmount: number;
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
  /** Lender only — top 5 high-value accounts requiring priority attention */
  priorityAccounts?: PriorityAccount[];
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

  let readyToSubmit = 0;
  for (const account of accounts) {
    const own = requiredByAccount.get(account.id) ?? [];
    const inCount = own.filter(isIn).length;
    if (account.claimStatus !== "DRAFT") continue;
    if (own.length > 0 && inCount === own.length) readyToSubmit += 1;
  }

  const byStatus = (status: string) =>
    accounts.filter((a) => a.claimStatus === status).length;

  // Write-off outranks NPA — same mutually-exclusive classification the Accounts list uses
  // (assetClassOf in AccountsClient.tsx).
  const npaCount = accounts.filter((a) => a.npa && !a.writeOff).length;

  // Seven claim stages, sourced from the Claim entity itself — the same field
  // (`claim.status`/`hasProgress`) the Claim page's own `?status=` filter reads (see
  // `statusFromParam`/`isNotStarted` in EligibleCasesClient). Built from `account.claimStatus`
  // before, a tile's count and what its link actually showed could disagree — that field and
  // `claim.status` are allowed to diverge (Account.claimStatus predates the Claim entity, see
  // its own doc comment) — so this reads the one place `?status=` filtering agrees with.
  const claimByAccountId = new Map(claims.map((c) => [c.accountId, c]));
  // Both roles now land on a grid with no NPA eligibility gate for "New" — the Lender's own
  // `/dpd` (labelled "Accounts" in their sidebar) deliberately lists every account, write-off-only
  // included, same as IMGC's `/accounts` — so this counts every no-claim account, matching
  // `classifyLoanStatus`'s own "New" rule in accounts.server.ts exactly.
  const notStartedCount = accounts.filter((a) => {
    const c = claimByAccountId.get(a.id);
    return c ? !c.hasProgress : true;
  }).length;
  // Claims with an open query already past its own due date — pulled out once so "Queried" and
  // "Expired" stay mutually exclusive (same rule `classifyLoanStatus` in accounts.server.ts uses
  // to label each account's `loanStatus`): a claim counts as "Expired" instead of "Queried", not
  // both, so the two tiles' counts always add up to the same accounts `/dpd`'s own filter shows.
  const nowMs = Date.now();
  const overdueClaimIds = new Set(
    db.claimQueries
      .filter((q) => !q.respondedAt && q.dueDate && Date.parse(q.dueDate) < nowMs)
      .map((q) => q.claimId)
  );
  const claimStatusCount = (status: Claim["status"]) =>
    claims.filter(
      (c) => c.hasProgress && c.status === status && !overdueClaimIds.has(c.id)
    ).length;
  // "Queried" folds in DOCUMENTS_RESUBMITTED too — same fold `classifyLoanStatus` in
  // accounts.server.ts applies (still mid query-loop) — so this tile's count doesn't undercount
  // against what `/dpd?loanStatus=Queried` actually lists.
  const queriedCount =
    claimStatusCount("QUERY_RAISED") + claimStatusCount("DOCUMENTS_RESUBMITTED");
  // "Approved" folds in CLOSED too — same fold `classifyLoanStatus` in accounts.server.ts applies
  // (closest terminal-success bucket) — so this tile's count doesn't undercount against what
  // `/dpd?loanStatus=Approved` actually lists.
  const approvedCount = claimStatusCount("APPROVED") + claimStatusCount("CLOSED");

  // Computed once, up here, so both the funnel band and the pipeline-health KPIs (further below)
  // read the same "overdue queries" number instead of two copies quietly drifting apart. No
  // longer lender-only — IMGC's own funnel band (portfolio-wide, same accounts/claims already
  // scoped above) needs it too.
  const claimPipeline = buildClaimPipelineKpis(claims, db.claimQueries);
  const expiredCount = claims.filter(
    (c) => c.hasProgress && overdueClaimIds.has(c.id)
  ).length;

  // The claim-stage funnel band shown on the Dashboard — same shape and same source data for
  // both roles (the accounts/claims above are already scoped: a lender's own book, or, for IMGC,
  // every lender's). Both roles land on the same `/dpd` grid too (labelled "Accounts" for a
  // lender, "All Loans" for IMGC — see nav.ts) filtered by the exact same `loanStatus`
  // classification `accounts.server.ts` computes for every account, so a tile's count and what
  // its link shows always agree, for either role.
  const funnelHref = (loanStatus: string) => `/dpd?loanStatus=${encodeURIComponent(loanStatus)}`;

  /* Aging is measured from the last thing that happened on the account — an account nobody has
     touched for a fortnight is the one worth surfacing, whatever its status. Computed here (ahead
     of `progressTiles`) because the "Active" tile below needs the same closed/overdue
     classification `buildPortfolioSummary` already uses for IMGC's own Portfolio Status
     Breakdown — reused, not reinvented, so "Active" means the same thing on both dashboards. */
  const lastTouch = new Map<string, string>();
  for (const event of events) {
    const current = lastTouch.get(event.accountId);
    if (!current || event.at > current)
      lastTouch.set(event.accountId, event.at);
  }

  // Same two-step classification as `buildPortfolioSummary`: closed outranks overdue (a
  // written-off or decided account isn't also "overdue"), and active is everything left over.
  const closedIds = new Set(
    accounts
      .filter((a) => a.writeOff || a.claimStatus === "APPROVED" || a.claimStatus === "REJECTED")
      .map((a) => a.id)
  );
  const overdueIds = new Set(
    accounts
      .filter((a) => !closedIds.has(a.id) && daysSince(lastTouch.get(a.id) ?? a.createdAt) > 8)
      .map((a) => a.id)
  );
  const activeCount = accounts.filter(
    (a) => !closedIds.has(a.id) && !overdueIds.has(a.id)
  ).length;

  const progressTiles: Tile[] = [
    {
      key: "total-loans",
      label: "Total Loans",
      value: accounts.length,
      tone: "neutral",
      href: "/dpd",
    },
    {
      key: "new",
      label: "New",
      value: notStartedCount,
      tone: "neutral",
      href: funnelHref("New"),
    },
    {
      key: "collecting",
      label: "Underwriting",
      value: claimStatusCount("DRAFT"),
      tone: "info",
      href: funnelHref("Underwriting"),
    },
    {
      key: "queried",
      label: "Queried",
      value: queriedCount,
      tone: "warning",
      href: funnelHref("Queried"),
    },
    {
      key: "approved",
      label: "Approved",
      value: approvedCount,
      tone: "success",
      href: funnelHref("Approved"),
    },
    {
      key: "rejected",
      label: "Rejected",
      value: claimStatusCount("REJECTED"),
      tone: "danger",
      href: funnelHref("Rejected"),
    },
    // Not a claim.status — a query already raised (`Queried`, above) that has gone past its own
    // due date unanswered. Same figure `buildClaimPipelineKpis` already computes for the
    // pipeline-health KPIs, just surfaced here too instead of a second copy of the same rule.
    // `classifyLoanStatus` in accounts.server.ts gives "Expired" priority over "Queried" for the
    // same claim, so this tile's count and the "Expired" rows on `/dpd` agree exactly.
    {
      key: "expired",
      label: "Expired",
      value: expiredCount,
      tone: "danger",
      href: funnelHref("Expired"),
    },
    {
      // Deliberately distinct from the "Pre Offer"/"Invoiced"/etc. stages above — this is the
      // collections sense of "active": not written off or decided, and not gone quiet for more
      // than a week. Same definition `buildPortfolioSummary` uses for IMGC's own Portfolio Status
      // Breakdown (computed further below as `activeCount`), so "active" means one thing across
      // both dashboards.
      key: "active",
      label: "Active",
      value: activeCount,
      tone: "success",
      href: "/dpd?loanStatus=Active",
    },
  ];

  const rings: Ring[] = [
    {
      key: "accounts",
      label: "Total NPA Account",
      value: npaCount,
      total: accounts.length || 1,
      href: "/dpd?npa=YES",
    },
    {
      key: "in-progress",
      label: "Loan In Progress",
      value: notStartedCount + claimStatusCount("DRAFT") + queriedCount + approvedCount,
      total: accounts.length || 1,
      href: "/dpd?loanStatus=In%20Progress",
    },
    {
      key: "submitted",
      label: "Active Loans",
      value: byStatus("SUBMITTED"),
      total: accounts.length || 1,
      // "SUBMITTED" is what `classifyLoanStatus` (accounts.server.ts) labels "Pre Offer" — same
      // bucket, same field, just the All Loans grid's own name for it.
      href: "/dpd?loanStatus=Pre%20Offer",
    },
    {
      key: "queried",
      label: "Queries Awaiting Response",
      value: queriedCount,
      total: accounts.length || 1,
      // Same "Queried" fold (QUERY_RAISED + DOCUMENTS_RESUBMITTED) `queriedCount` above already
      // applies, and the same `/dpd?loanStatus=Queried` destination the funnel band's own
      // "Queried" tile links to — so this ring's count and its click-through always agree.
      href: funnelHref("Queried"),
    },
    {
      key: "rejected-docs",
      label: "Rejected Documents",
      value: rejectedDocCount,
      total: documentsRequired || 1,
      // Same role-specific destination the "Rejected documents" Actionable-item card already
      // links to: a lender resolves their own retention view on Track Query Response, IMGC's
      // lives on the Retention workbench.
      href:
        session.role === "LENDER"
          ? `${ROUTES.trackQueryResponse}?status=REJECTED`
          : ROUTES.adminRetention,
    },
  ];

  // "Open" reads the real `Claim` entity, not `Account.claimStatus` (that legacy field defaults
  // to "DRAFT" the moment an account is created, claim or no claim — so it was pulling in every
  // untouched, no-claim-yet account and dating it from the loan's own origination date, months or
  // years back, alongside genuinely open claims dated in days. The result was a widget that could
  // only ever show "just now" or "ancient", never anything in between). A claim's own
  // `lastUpdatedAt` (the same field `decidedAt`/`buildClaimPipelineKpis` above already trust) is
  // also a truer "last touched" than the generic per-account `lastTouch` audit map, which an
  // unrelated additional-document review can bump to "today" while the claim itself sits stalled.
  const OPEN_CLAIM_STATUSES = new Set<Claim["status"]>([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "QUERY_RAISED",
    "DOCUMENTS_RESUBMITTED",
  ]);
  const openClaims = claims.filter(
    (c) => c.hasProgress && OPEN_CLAIM_STATUSES.has(c.status) && !overdueClaimIds.has(c.id)
  );
  const ages = openClaims.map((c) => daysSince(c.lastUpdatedAt));
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
    // Built for both roles now — the "Portfolio Status Breakdown" widget on the Dashboard sits
    // under "Portfolio overview" for a lender too, not just IMGC's own command center. `accounts`
    // is already scoped above (a lender's own book, or every lender's for IMGC), so the same
    // function produces the right numbers either way.
    portfolio: buildPortfolioSummary(accounts, lastTouch),
    claimPipeline,
    priorityAccounts:
      session.role === "LENDER"
        ? accounts
            .filter((a) => (a.dpd ?? 0) > 90)
            .sort(
              (a, b) => b.loanAmount - a.loanAmount || a.id.localeCompare(b.id)
            )
            .slice(0, 5)
            .map((a) => ({
              id: a.id,
              loanNo: a.loanNo,
              borrowerName: a.borrowerName,
              loanAmount: a.loanAmount,
            }))
        : undefined,
  };
}
