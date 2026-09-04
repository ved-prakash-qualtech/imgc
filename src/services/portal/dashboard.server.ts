import "server-only";

import { readDb } from "@/server/mock/db";
import type { AppSession } from "@/lib/auth/appSession";
import type { ClaimDocument } from "@/server/mock/types";

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
  progressTiles: Tile[];
  rings: Ring[];
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
  lenderHero?: {
    totalClaims: number;
    claimInitiation: number;
    underProgress: number;
    claimApproved: number;
    claimRejected: number;
  };
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
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

  const npaCount = accounts.filter((a) => a.npa).length;

  const isLender = session.role === "LENDER";

  const progressTiles: Tile[] = [
    {
      key: "new",
      label: "New",
      value: untouched,
      tone: "neutral",
      href: isLender ? "/initiate-claim" : "/accounts?status=DRAFT&docs=none",
    },
    {
      key: "collecting",
      label: "Underwriting",
      value: partly,
      tone: "info",
      href: isLender
        ? "/initiate-claim"
        : "/accounts?status=DRAFT&docs=partial",
    },
    {
      key: "ready",
      label: "Pre Offer",
      value: readyToSubmit,
      tone: "teal",
      href: isLender
        ? "/initiate-claim"
        : "/accounts?status=DRAFT&docs=complete",
    },
    {
      key: "submitted",
      label: "Invoiced",
      value: byStatus("SUBMITTED"),
      tone: "violet",
      href: isLender
        ? "/track-query-response?status=SUBMITTED"
        : "/accounts?status=SUBMITTED",
    },
    {
      key: "queried",
      label: "Queried",
      value: byStatus("QUERIED"),
      tone: "warning",
      href: isLender
        ? "/track-query-response?status=QUERY_RAISED"
        : "/accounts?status=QUERIED",
    },
    {
      key: "approved",
      label: "Approved",
      value: byStatus("APPROVED"),
      tone: "success",
      href: isLender
        ? "/track-query-response?status=APPROVED"
        : "/accounts?status=APPROVED",
    },
    {
      key: "rejected",
      label: "Rejected",
      value: rejectedDocCount,
      tone: "danger",
      href: isLender ? "/track-query-response?status=REJECTED" : "/accounts",
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
        ? "/track-query-response?status=SUBMITTED"
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
    progressTiles,
    rings,
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
    lenderHero: (() => {
      const claims = db.claims.filter((c) => ids.has(c.accountId));
      const terminalOrDraft = new Set([
        "DRAFT",
        "APPROVED",
        "REJECTED",
        "CLOSED",
      ]);
      return {
        totalClaims: claims.length,
        claimInitiation: claims.filter((c) => c.status === "DRAFT").length,
        underProgress: claims.filter((c) => !terminalOrDraft.has(c.status))
          .length,
        claimApproved: claims.filter((c) => c.status === "APPROVED").length,
        claimRejected: claims.filter((c) => c.status === "REJECTED").length,
      };
    })(),
  };
}
