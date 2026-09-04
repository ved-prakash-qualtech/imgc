import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import { sendMail } from "@/server/mock/mailer";
import { claimConfig, LENDER_ACTIONABLE, TERMINAL_STATUSES } from "@/config/claimConfig";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  Account,
  Claim,
  ClaimAction,
  ClaimQuery,
  ClaimStatus,
  ClaimTypeKey,
  MockDb,
} from "@/server/mock/types";

/**
 * The claim engine.
 *
 * Everything the lender and IMGC do to a claim passes through here, so the status a screen shows
 * and the status the rules produce cannot drift. Nothing in this file branches on claim type —
 * that lives entirely in `config/claimConfig`.
 */

export type Outcome = Readonly<{ ok: boolean; error?: string; claimId?: string }>;

/* ── eligibility ───────────────────────────────────────────────────── */

export interface AccountClaimState {
  action: ClaimAction;
  claim: Claim | null;
  /** Why the action is DISABLED, for the tooltip. */
  reason?: string;
}

/**
 * What the lender may do with an account — the one place this is decided.
 *
 * Every grid, row and button reads this rather than testing `npa || writeOff` for itself, which
 * is how three components end up disagreeing about whether a button should be there.
 */
export function getClaimAction(
  account: Pick<Account, "npa" | "writeOff">,
  claim: Claim | null
): AccountClaimState {
  if (claim) {
    if (TERMINAL_STATUSES.has(claim.status)) {
      return { action: "VIEW", claim };
    }
    if (LENDER_ACTIONABLE.has(claim.status)) {
      // A draft is still being prepared, and a query is waiting on the lender — both are
      // "carry on where you left off", not "start something new".
      return { action: "INITIATE", claim };
    }
    return { action: "TRACK", claim };
  }

  if (!account.npa && !account.writeOff) {
    return {
      action: "DISABLED",
      claim: null,
      reason: "A claim can only be raised once the account is NPA or written off.",
    };
  }
  return { action: "INITIATE", claim: null };
}

/* ── reads ─────────────────────────────────────────────────────────── */

function scoped(db: MockDb, session: AppSession): Set<string> {
  return new Set(
    db.accounts
      .filter((a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId)
      .map((a) => a.id)
  );
}

export interface ClaimRow extends Claim {
  caseId: string;
  customerName: string;
  lenderName: string;
  product: string;
  typeLabel: string;
  openQuery: ClaimQuery | null;
  requiredDocs: number;
  approvedDocs: number;
}

function decorate(claim: Claim, db: MockDb): ClaimRow {
  const account = db.accounts.find((a) => a.id === claim.accountId);
  const org = db.lenderOrgs.find((o) => o.id === account?.lenderOrgId);
  const docs = db.claimDocuments.filter((d) => d.claimId === claim.id);
  const required = docs.filter((d) => d.required && d.active !== false);
  return {
    ...claim,
    caseId: account?.loanNo ?? "—",
    customerName: account?.borrowerName ?? "—",
    lenderName: org?.name ?? "—",
    product: account?.product ?? "—",
    typeLabel: claimConfig(claim.claimType).label,
    openQuery:
      db.claimQueries
        .filter((q) => q.claimId === claim.id && !q.respondedAt)
        .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))[0] ?? null,
    requiredDocs: required.length,
    approvedDocs: required.filter((d) => d.status === "APPROVED").length,
  };
}

export async function listClaims(session: AppSession): Promise<ClaimRow[]> {
  const db = await readDb();
  const ids = scoped(db, session);
  return db.claims
    .filter((c) => ids.has(c.accountId))
    .map((c) => decorate(c, db))
    .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}

export async function getClaim(
  session: AppSession,
  claimId: string
): Promise<ClaimRow | null> {
  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return null;
  if (!scoped(db, session).has(claim.accountId)) return null;
  return decorate(claim, db);
}

export async function getClaimForAccount(
  session: AppSession,
  accountId: string
): Promise<ClaimRow | null> {
  const rows = await listClaims(session);
  return rows.find((c) => c.accountId === accountId) ?? null;
}

export async function listQueries(claimId: string): Promise<ClaimQuery[]> {
  const db = await readDb();
  return db.claimQueries
    .filter((q) => q.claimId === claimId)
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
}

/* ── helpers ───────────────────────────────────────────────────────── */

function nextClaimNo(db: MockDb, type: ClaimTypeKey): string {
  const prefix = claimConfig(type).prefix;
  const year = new Date().getFullYear();
  const used = db.claims.filter((c) => c.claimNo.startsWith(`${prefix}-${year}-`)).length;
  return `${prefix}-${year}-${String(used + 1).padStart(5, "0")}`;
}

function advance(
  claim: Claim,
  status: ClaimStatus,
  session: AppSession,
  note?: string
): void {
  claim.status = status;
  claim.lastUpdatedAt = nowIso();
  claim.statusHistory.push({
    status,
    at: nowIso(),
    byId: session.userId,
    byName: session.name,
    byRole: session.role,
    note,
  });
}

/* ── lender actions ────────────────────────────────────────────────── */

/**
 * Start a claim, materialising the configured checklist as real document rows.
 *
 * The checklist is copied from config at creation rather than read live, so changing the config
 * later cannot silently alter what an in-flight claim was asked for.
 */
export async function createClaim(
  session: AppSession,
  accountId: string,
  claimType: ClaimTypeKey
): Promise<Outcome> {
  if (session.role !== "LENDER") {
    return { ok: false, error: "Only a lender can raise a claim." };
  }

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Account not found." };
  if (account.lenderOrgId !== session.lenderOrgId) {
    return { ok: false, error: "That account belongs to another lender." };
  }
  const existing = db.claims.find((c) => c.accountId === accountId);
  if (existing) return { ok: true, claimId: existing.id };
  if (!account.npa && !account.writeOff) {
    return {
      ok: false,
      error: "A claim can only be raised once the account is NPA or written off.",
    };
  }

  const claimId = newId("clm");
  const config = claimConfig(claimType);

  await writeDb((fresh) => {
    fresh.claims.push({
      id: claimId,
      claimNo: nextClaimNo(fresh, claimType),
      accountId,
      claimType,
      status: "DRAFT",
      fields: {},
      statusHistory: [
        {
          status: "DRAFT",
          at: nowIso(),
          byId: session.userId,
          byName: session.name,
          byRole: session.role,
          note: `${config.label} initiated`,
        },
      ],
      createdById: session.userId,
      createdByName: session.name,
      createdAt: nowIso(),
      lastUpdatedAt: nowIso(),
      bucket: "LENDER",
    });

    config.documents.forEach((spec, i) => {
      fresh.claimDocuments.push({
        id: `${claimId}_doc${i}`,
        accountId,
        claimId,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        required: spec.required,
        addedBy: "SYSTEM",
        status: "PENDING_UPLOAD",
        version: 0,
        active: true,
        createdAt: nowIso(),
      });
    });
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `${config.label} initiated`,
    meta: { claimId, claimType },
  });
  return { ok: true, claimId };
}

/** Save the form without submitting. Status stays DRAFT. */
export async function saveClaimDraft(
  session: AppSession,
  claimId: string,
  fields: Record<string, string>
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;

  await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return;
    claim.fields = { ...claim.fields, ...fields };
    claim.lastUpdatedAt = nowIso();
  });

  await recordEvent({
    accountId: guard.accountId!,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: "Claim draft saved",
    meta: { claimId },
  });
  return { ok: true, claimId };
}

export interface SubmitCheck {
  ok: boolean;
  missingFields: string[];
  missingDocuments: string[];
}

/** What still stands between a draft and submission. Drives the disabled Submit button. */
export async function checkSubmittable(
  claimId: string,
  overrides?: Record<string, string>
): Promise<SubmitCheck> {
  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return { ok: false, missingFields: [], missingDocuments: [] };

  const config = claimConfig(claim.claimType);
  const values = { ...claim.fields, ...(overrides ?? {}) };

  const missingFields = config.fields
    .filter((f) => f.required && !String(values[f.id] ?? "").trim())
    .map((f) => f.label);

  const missingDocuments = db.claimDocuments
    .filter(
      (d) =>
        d.claimId === claimId &&
        d.required &&
        d.active !== false &&
        d.status !== "UNDER_REVIEW" &&
        d.status !== "APPROVED"
    )
    .map((d) => d.name);

  return {
    ok: missingFields.length === 0 && missingDocuments.length === 0,
    missingFields,
    missingDocuments,
  };
}

export async function submitClaim(
  session: AppSession,
  claimId: string,
  fields: Record<string, string>
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;

  await saveClaimDraft(session, claimId, fields);
  const check = await checkSubmittable(claimId);
  if (!check.ok) {
    const parts = [
      check.missingFields.length ? `fields: ${check.missingFields.join(", ")}` : "",
      check.missingDocuments.length
        ? `documents: ${check.missingDocuments.join(", ")}`
        : "",
    ].filter(Boolean);
    return { ok: false, error: `Still outstanding — ${parts.join("; ")}.` };
  }

  const claimNo = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return "";
    // Answering a query resubmits; a first submission submits. Both land with IMGC.
    const resubmitting = claim.status === "QUERY_RAISED";
    advance(
      claim,
      resubmitting ? "DOCUMENTS_RESUBMITTED" : "SUBMITTED",
      session
    );
    if (!claim.submittedAt) claim.submittedAt = nowIso();
    claim.bucket = "IMGC";

    if (resubmitting) {
      const open = db.claimQueries
        .filter((q) => q.claimId === claimId && !q.respondedAt)
        .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))[0];
      if (open) {
        open.respondedAt = nowIso();
        open.respondedById = session.userId;
        open.respondedByName = session.name;
        open.responseRemarks = fields.__queryResponse ?? "Documents resubmitted.";
      }
      // Rule: a resubmission goes straight back into review.
      advance(claim, "UNDER_REVIEW", session, "Resubmission received");
    }
    return claim.claimNo;
  });

  await recordEvent({
    accountId: guard.accountId!,
    actor: session,
    type: "CLAIM_SUBMITTED",
    summary: `Claim ${claimNo} submitted to IMGC`,
    meta: { claimId },
  });
  await notify(guard.accountId!, {
    subject: `Claim ${claimNo} submitted`,
    body: `${session.name} submitted claim ${claimNo}. It is now with IMGC for review.`,
    event: "CLAIM_SUBMITTED",
    unreadFor: ["IMGC"],
  });
  return { ok: true, claimId };
}

/* ── IMGC actions ──────────────────────────────────────────────────── */

export async function updateClaimStatus(
  session: AppSession,
  claimId: string,
  status: ClaimStatus,
  remarks: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false as const, error: "Claim not found." };
    advance(claim, status, session, remarks || undefined);
    if (status === "APPROVED" || status === "REJECTED" || status === "CLOSED") {
      claim.decision = {
        outcome: status,
        byId: session.userId,
        byName: session.name,
        at: nowIso(),
        remarks,
      };
    }
    return { ok: true as const, accountId: claim.accountId, claimNo: claim.claimNo };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId: outcome.accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Claim ${outcome.claimNo} → ${status}${remarks ? ` — ${remarks}` : ""}`,
    meta: { claimId, status },
  });
  await notify(outcome.accountId, {
    subject: `Claim ${outcome.claimNo} is now ${status.replace(/_/g, " ").toLowerCase()}`,
    body: `${session.name} moved claim ${outcome.claimNo} to ${status}.${remarks ? ` Remarks: ${remarks}` : ""}`,
    event: "CLAIM_STATUS_CHANGED",
    unreadFor: ["LENDER"],
  });
  return { ok: true, claimId };
}

export async function raiseQuery(
  session: AppSession,
  claimId: string,
  input: { reason: string; remarks: string; requestedDocuments: string[] }
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  if (!input.reason.trim()) return { ok: false, error: "A query needs a reason." };

  const outcome = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false as const, error: "Claim not found." };
    if (TERMINAL_STATUSES.has(claim.status)) {
      return { ok: false as const, error: "That claim is already closed." };
    }

    db.claimQueries.push({
      id: newId("qry"),
      claimId,
      reason: input.reason.trim(),
      remarks: input.remarks.trim(),
      requestedDocuments: input.requestedDocuments,
      raisedById: session.userId,
      raisedByName: session.name,
      raisedAt: nowIso(),
    });

    // A requested document goes back to the lender to provide again.
    for (const name of input.requestedDocuments) {
      const doc = db.claimDocuments.find(
        (d) => d.claimId === claimId && d.name === name
      );
      if (doc) doc.status = "REUPLOAD_REQUIRED";
    }

    advance(claim, "QUERY_RAISED", session, input.reason.trim());
    claim.bucket = "LENDER";
    return { ok: true as const, accountId: claim.accountId, claimNo: claim.claimNo };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId: outcome.accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Query raised on ${outcome.claimNo} — ${input.reason.trim()}`,
    meta: { claimId },
  });
  await notify(outcome.accountId, {
    subject: `Query raised on claim ${outcome.claimNo}`,
    body:
      `${session.name} raised a query on ${outcome.claimNo}. Reason: ${input.reason.trim()}.` +
      (input.requestedDocuments.length
        ? ` Requested: ${input.requestedDocuments.join(", ")}.`
        : ""),
    event: "CLAIM_QUERY_RAISED",
    unreadFor: ["LENDER"],
  });
  return { ok: true, claimId };
}

/* ── internals ─────────────────────────────────────────────────────── */

async function assertLenderOwns(
  session: AppSession,
  claimId: string
): Promise<Outcome & { accountId?: string }> {
  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return { ok: false, error: "Claim not found." };
  const account = db.accounts.find((a) => a.id === claim.accountId);
  if (!account) return { ok: false, error: "Account not found." };
  if (session.role !== "LENDER" || account.lenderOrgId !== session.lenderOrgId) {
    return { ok: false, error: "That claim belongs to another lender." };
  }
  return { ok: true, accountId: claim.accountId };
}

async function notify(
  accountId: string,
  msg: {
    subject: string;
    body: string;
    event: string;
    unreadFor: ("IMGC" | "LENDER")[];
  }
): Promise<void> {
  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return;
  const org = db.lenderOrgs.find((o) => o.id === account.lenderOrgId);
  const imgc = db.users.filter((u) => u.role === "IMGC").map((u) => u.email);
  await sendMail({
    to: [...(org?.contactEmails ?? []), ...imgc, ...account.pushRecipients],
    subject: `[${account.loanNo}] ${msg.subject}`,
    body: msg.body,
    event: msg.event,
    accountId,
    unreadFor: msg.unreadFor,
  });
}

/**
 * A lender asking IMGC a question about their own claim.
 *
 * Deliberately not `raiseQuery`: a formal query is IMGC halting the claim and demanding a
 * response, and letting a lender do that to their own claim would let them park it and stop the
 * clock. This records the question, notifies IMGC and leaves the status exactly where it was.
 */
export async function askClaimQuestion(
  session: AppSession,
  claimId: string,
  question: string
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;
  const body = question.trim();
  if (!body) return { ok: false, error: "Write your question first." };

  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return { ok: false, error: "Claim not found." };

  await writeDb((fresh) => {
    fresh.remarks.unshift({
      id: newId("rmk"),
      accountId: claim.accountId,
      authorId: session.userId,
      authorName: session.name,
      authorRole: session.role,
      body: `Question on ${claim.claimNo}: ${body}`,
      createdAt: nowIso(),
    });
    const row = fresh.claims.find((c) => c.id === claimId);
    if (row) row.lastUpdatedAt = nowIso();
  });

  await recordEvent({
    accountId: claim.accountId,
    actor: session,
    type: "REMARK_ADDED",
    summary: `Lender raised a question on ${claim.claimNo} — ${body}`,
    meta: { claimId },
  });
  await notify(claim.accountId, {
    subject: `Question raised on claim ${claim.claimNo}`,
    body: `${session.name} asked: ${body}`,
    event: "CLAIM_QUESTION_RAISED",
    unreadFor: ["IMGC"],
  });
  return { ok: true, claimId };
}
