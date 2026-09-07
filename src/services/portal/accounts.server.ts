import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { recordEvent } from "@/services/portal/audit.server";
import {
  notifyBucketShift,
  notifyClaimDecision,
} from "@/services/portal/notifications.server";
import { addRemark } from "@/services/portal/remarks.server";
import { getClaimForAccount, syncClaimForAccountDecision } from "@/services/portal/claimFlow.server";
import { listDocuments, summariseDocs } from "@/services/portal/claims.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  Account,
  Bucket,
  Claim,
  ClaimQuery,
  ClaimStatus,
  LenderOrg,
} from "@/server/mock/types";

export interface AccountRow extends Account {
  lenderOrgName: string;
  requiredDocs: number;
  pendingDocs: number;
  loanStatus: string;
}

/** The one place lender scoping is applied: a lender sees an account iff the org ids match. */
function inScope(session: AppSession, account: Account): boolean {
  if (session.role === "IMGC") return true;
  return account.lenderOrgId === session.lenderOrgId;
}

/**
 * The same eight claim stages the Dashboard's "In progress claim cases" band classifies accounts
 * into (see `buildDashboardSummary`'s `progressTiles` in dashboard.server.ts) — kept as one
 * mutually-exclusive label per account here so this list's own status filter can select one, and
 * so a KPI tile's link (`?loanStatus=<label>`) lands on the same rows the tile counted.
 *
 * `DOCUMENTS_RESUBMITTED` folds into "Queried" (still mid query-loop) and `CLOSED` folds into
 * "Approved" (closest terminal-success bucket — same stand-in `ClaimOverviewBand` uses for "Claim
 * Paid"). "Expired" takes priority over "Queried" for the same claim, since a query overdue past
 * its due date is a more specific, more urgent state than "queried" alone.
 */
function classifyLoanStatus(
  account: Account,
  claim: Claim | undefined,
  queries: ClaimQuery[]
): string {
  if (!claim || !claim.draftSaved) return "New";

  const now = Date.now();
  const isOverdue = queries.some(
    (q) =>
      q.claimId === claim.id &&
      !q.respondedAt &&
      q.dueDate &&
      Date.parse(q.dueDate) < now
  );
  if (isOverdue) return "Expired";

  switch (claim.status) {
    case "DRAFT":
      return "Underwriting";
    case "SUBMITTED":
      return "Pre Offer";
    case "UNDER_REVIEW":
      return "Invoiced";
    case "QUERY_RAISED":
    case "DOCUMENTS_RESUBMITTED":
      return "Queried";
    case "REJECTED":
      return "Rejected";
    case "APPROVED":
    case "CLOSED":
      return "Approved";
    default:
      return "New";
  }
}

function decorate(
  account: Account,
  orgs: LenderOrg[],
  docs: { accountId: string; required: boolean; status: string; active?: boolean }[],
  claims: Claim[],
  queries: ClaimQuery[]
): AccountRow {
  const own = docs.filter((d) => d.accountId === account.id);
  const claim = claims.find((c) => c.accountId === account.id);

  return {
    ...account,
    loanStatus: classifyLoanStatus(account, claim, queries),
    lenderOrgName: orgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
    requiredDocs: own.filter((d) => d.required && d.active !== false).length,
    pendingDocs: own.filter((d) => d.required && d.active !== false && d.status !== "UNDER_REVIEW" && d.status !== "APPROVED").length,
  };
}

export async function listAccounts(session: AppSession): Promise<AccountRow[]> {
  const db = await readDb();
  return db.accounts
    .filter((a) => inScope(session, a))
    .map((a) => decorate(a, db.lenderOrgs, db.claimDocuments, db.claims, db.claimQueries))
    .sort((a, b) => a.loanNo.localeCompare(b.loanNo));
}

export async function getAccount(
  session: AppSession,
  accountId: string
): Promise<AccountRow | null> {
  const db = await readDb();
  const a = db.accounts.find((x) => x.id === accountId);
  if (!a || !inScope(session, a)) return null;
  return decorate(a, db.lenderOrgs, db.claimDocuments, db.claims, db.claimQueries);
}

export async function listAccessibleAccountIds(session: AppSession): Promise<string[]> {
  const db = await readDb();
  return db.accounts.filter((a) => inScope(session, a)).map((a) => a.id);
}

export async function getLenderOrg(orgId: string): Promise<LenderOrg | null> {
  const db = await readDb();
  return db.lenderOrgs.find((o) => o.id === orgId) ?? null;
}

/* ── IMGC mutations ────────────────────────────────────────────────── */

export async function shiftBucket(
  session: AppSession,
  accountId: string,
  to: Bucket,
  extraRecipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const, error: "Account not found." };
    const from = account.bucket;
    if (from === to) return { ok: false as const, error: `Already in the ${to} bucket.` };
    account.bucket = to;
    account.stage = to === "IMGC" ? "Under IMGC review" : "Document collection";
    account.pushRecipients = Array.from(
      new Set([...account.pushRecipients, ...extraRecipients.map((e) => e.trim()).filter(Boolean)])
    );
    return { ok: true as const, from, account: { ...account } };
  });

  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "BUCKET_SHIFTED",
    summary: `Account moved from the ${outcome.from} bucket to the ${to} bucket`,
    meta: { from: outcome.from, to },
  });
  await notifyBucketShift(outcome.account, outcome.from, to, session);
  return { ok: true };
}

export async function setClaimStatus(
  session: AppSession,
  accountId: string,
  status: Extract<ClaimStatus, "APPROVED" | "QUERIED">,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return { ok: false, error: "Note is required before you can proceed." };
  }

  const outcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const, error: "Account not found." };
    const from = account.claimStatus;
    return { ok: true as const, from, account: { ...account } };
  });
  if (!outcome.ok) return outcome;

  if (status === "APPROVED") {
    // Once a specific claim has been initiated, its own checklist (`claimId`-scoped) is the real
    // document list for it — `listDocuments` also returns the account's older, claim-agnostic
    // "standard" documents (from before the claim existed), and requiring those too meant a claim
    // could sit fully approved on its own checklist and still get blocked by unrelated documents
    // nobody was ever asked to touch for it.
    const claim = await getClaimForAccount(session, accountId);
    const docs = claim
      ? await listClaimDocuments(session, claim.id)
      : await listDocuments(session, accountId);
    const summary = summariseDocs(docs);
    if (!summary.complete) {
      return {
        ok: false,
        error: "Please approve all required documents before marking the claim approved.",
      };
    }
  }

  const updateOutcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const, error: "Account not found." };
    
    let bucketChangedFrom = null;
    if (status === "QUERIED" && account.bucket !== "LENDER") {
      bucketChangedFrom = account.bucket;
      account.bucket = "LENDER";
    }

    account.claimStatus = status;
    // The processing itself happened in PAS; the portal records the outcome and the stage the
    // lender now sees against the account.
    account.stage = status === "APPROVED" ? "Claim approved" : "Query raised with the lender";
    return { ok: true as const, from: outcome.from, bucketChangedFrom, account: { ...account } };
  });
  if (!updateOutcome.ok) return updateOutcome;

  if (updateOutcome.bucketChangedFrom) {
    await recordEvent({
      accountId,
      actor: session,
      type: "BUCKET_SHIFTED",
      summary: `Account moved from the ${updateOutcome.bucketChangedFrom} bucket to the LENDER bucket`,
      meta: { from: updateOutcome.bucketChangedFrom, to: "LENDER" },
    });
    await notifyBucketShift(updateOutcome.account, updateOutcome.bucketChangedFrom, "LENDER", session);
  }

  // The Overview tab only ever wrote this account's own claimStatus; the Claim entity — what
  // Track Claim, the lender's workspace and this claim's status-history graph read — was left
  // behind. Sync it here so an approval or query made from this screen shows up everywhere else.
  await syncClaimForAccountDecision(session, accountId, status, trimmedNote);

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Claim marked ${status}${trimmedNote ? ` — ${trimmedNote}` : ""}`,
    meta: { status, from: outcome.from },
  });

  // The note goes on the remarks thread as well as into the audit meta. The audit trail is a
  // record for whoever investigates later; the remark is what the lender actually reads, and a
  // query whose reason is only in an audit row reads to them as a refusal with no explanation.
  if (trimmedNote) {
    await addRemark(
      session,
      accountId,
      `Claim ${status.toLowerCase()}: ${trimmedNote}`
    );
  }

  await notifyClaimDecision(updateOutcome.account, status, trimmedNote, session);
  return { ok: true };
}

export async function setPushRecipients(
  session: AppSession,
  accountId: string,
  recipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (account) {
      account.pushRecipients = recipients.map((r) => r.trim()).filter(Boolean);
    }
  });
  return { ok: true };
}
