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
  tone: "neutral" | "info" | "warning" | "success" | "danger" | "violet" | "teal";
}

export interface Ring {
  key: string;
  label: string;
  value: number;
  /** Denominator the ring fills against. */
  total: number;
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
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

function isIn(doc: ClaimDocument): boolean {
  return doc.status === "UPLOADED" || doc.status === "ACCEPTED";
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

  const acceptedDocs = docs.filter((d) => d.status === "ACCEPTED").length;
  const uploadedDocs = docs.filter((d) => d.status === "UPLOADED").length;
  const pendingDocs = docs.filter((d) => d.status === "PENDING").length;
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

  const progressTiles: Tile[] = [
    { key: "new", label: "Not started", value: untouched, tone: "neutral" },
    { key: "collecting", label: "Collecting documents", value: partly, tone: "info" },
    { key: "ready", label: "Ready to submit", value: readyToSubmit, tone: "teal" },
    { key: "submitted", label: "Submitted", value: byStatus("SUBMITTED"), tone: "violet" },
    { key: "queried", label: "Queried", value: byStatus("QUERIED"), tone: "warning" },
    { key: "approved", label: "Approved", value: byStatus("APPROVED"), tone: "success" },
    { key: "rejected", label: "Documents rejected", value: rejectedDocCount, tone: "danger" },
    {
      key: "with-imgc",
      label: "With IMGC",
      value: accounts.filter((a) => a.bucket === "IMGC").length,
      tone: "info",
    },
  ];

  const totalDocs = docs.length || 1;
  const rings: Ring[] = [
    { key: "accounts", label: "Total accounts", value: accounts.length, total: accounts.length || 1 },
    {
      key: "in-progress",
      label: "Claims in progress",
      value: untouched + partly,
      total: accounts.length || 1,
    },
    { key: "submitted", label: "Claims submitted", value: byStatus("SUBMITTED"), total: accounts.length || 1 },
    { key: "approved", label: "Claims approved", value: byStatus("APPROVED"), total: accounts.length || 1 },
    { key: "docs-in", label: "Mandatory documents in", value: documentsIn, total: documentsRequired || 1 },
    { key: "accepted", label: "Documents accepted", value: acceptedDocs, total: totalDocs },
    { key: "awaiting", label: "Documents awaiting review", value: uploadedDocs, total: totalDocs },
    { key: "outstanding", label: "Documents outstanding", value: pendingDocs, total: totalDocs },
  ];

  /* Aging is measured from the last thing that happened on the account — an account nobody has
     touched for a fortnight is the one worth surfacing, whatever its status. */
  const lastTouch = new Map<string, string>();
  for (const event of events) {
    const current = lastTouch.get(event.accountId);
    if (!current || event.at > current) lastTouch.set(event.accountId, event.at);
  }

  const open = accounts.filter(
    (a) => a.claimStatus === "DRAFT" || a.claimStatus === "QUERIED"
  );
  const ages = open.map((a) => daysSince(lastTouch.get(a.id) ?? a.createdAt));
  const band = (min: number, max: number) =>
    ages.filter((d) => d >= min && d <= max).length;

  const openTotal = ages.length || 1;
  const raw: ReadonlyArray<[string, number, AgingBand["tone"]]> = [
    ["0–2 days", band(0, 2), "info"],
    ["3–5 days", band(3, 5), "brand"],
    ["6–8 days", band(6, 8), "warning"],
    ["8+ days", ages.filter((d) => d > 8).length, "danger"],
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
  };
}
