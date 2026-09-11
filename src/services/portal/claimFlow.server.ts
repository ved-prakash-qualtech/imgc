/* eslint-disable use-client/browser-api, security/detect-object-injection */
import "server-only";

import path from "node:path";

import { readDb, writeDb } from "@/server/mock/db";
import { putUpload } from "@/server/mock/storage";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import { sendMail } from "@/server/mock/mailer";
import { notifyBucketShift } from "@/services/portal/notifications.server";
import {
  claimConfig,
  conditionReason,
  docConditionMet,
  fieldVisible,
  LENDER_ACTIONABLE,
  TERMINAL_STATUSES,
  toAccountClaimStatus,
} from "@/config/claimConfig";
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

export type Outcome = Readonly<{
  ok: boolean;
  error?: string;
  claimId?: string;
  /** So the caller can revalidate the account's own pages — not every mutation has one to give. */
  accountId?: string;
}>;

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
      reason:
        "A claim can only be raised once the account is NPA or written off.",
    };
  }
  return { action: "INITIATE", claim: null };
}

/* ── reads ─────────────────────────────────────────────────────────── */

function scoped(db: MockDb, session: AppSession): Set<string> {
  return new Set(
    db.accounts
      .filter(
        (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
      )
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
  /**
   * Whether this claim has actually got going, as opposed to being an empty shell.
   *
   * A draft is auto-created the moment "Initiate Claim" is opened, so mere existence isn't
   * enough: opening the workspace and leaving without saving anything should still read
   * "Initiate Claim" in the grid, not "Continue Claim" — that is what `Claim.draftSaved` records.
   *
   * But the lender is not the only one who can move a claim. IMGC rejecting a document raises a
   * query and advances the claim, which can leave a `QUERY_RAISED` claim whose `draftSaved` was
   * never set. Reading `draftSaved` alone then called that claim "Not started": it dropped out of
   * the grid's "Under progress" filter while the Claims Overview band — which reads the claim's
   * status — still counted it, and its row offered "Initiate" on a claim already under query.
   * Anything past DRAFT has demonstrably started, whoever moved it.
   */
  hasProgress: boolean;
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
    hasProgress: Boolean(claim.draftSaved) || claim.status !== "DRAFT",
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

/* ── claim overview (shared by the Claim page and the Dashboard) ─────── */

/** In-flight — submitted but not yet decided one way or the other. */
const UNDER_PROGRESS_STATUSES = new Set<ClaimStatus>([
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "DOCUMENTS_RESUBMITTED",
]);

export interface ClaimOverviewCounts {
  total: number;
  initiation: number;
  underProgress: number;
  approved: number;
  rejected: number;
}

/**
 * The same four mutually-exclusive buckets, over whatever universe of accounts the caller
 * considers "in scope" (the Claim page's own eligible-accounts row set; the Dashboard's
 * lender/IMGC-scoped account set) — one function, so the Claim page and the Dashboard can never
 * quietly disagree about what "under progress" or "approved" means.
 *
 * `CLOSED` folds into `approved` — the same fold `classifyLoanStatus` (accounts.server.ts) and
 * the Dashboard's own "Approved" KPI already apply (closest terminal-success bucket, since the
 * claim workflow has no separate PAID status). A `CLOSED` claim used to fall into a `paid` bucket
 * this band never rendered a tile for — invisible in the KPI band even though the same account
 * reads "Approved" everywhere else in the app (Dashboard, All Loans) — so the four visible tiles
 * silently undercounted against "total" whenever any claim had actually reached CLOSED.
 */
export function summariseClaimOverview(
  rows: ReadonlyArray<{ claim: { status: ClaimStatus } | null }>
): ClaimOverviewCounts {
  let initiation = 0;
  let underProgress = 0;
  let approved = 0;
  let rejected = 0;

  for (const row of rows) {
    const status = row.claim?.status;
    if (!status || status === "DRAFT") initiation += 1;
    else if (UNDER_PROGRESS_STATUSES.has(status)) underProgress += 1;
    // "Refund received" is a confirmation on top of an already-approved claim, not a fourth
    // outcome — it stays counted as "approved" here, same as CLOSED above, so this tile doesn't
    // drop a claim the moment IMGC confirms the refund for it.
    else if (
      status === "APPROVED" ||
      status === "CLOSED" ||
      status === "REFUND_RECEIVED_BY_IMGC"
    )
      approved += 1;
    else if (status === "REJECTED") rejected += 1;
  }

  return {
    total: initiation + underProgress,
    initiation,
    underProgress,
    approved,
    rejected,
  };
}

/* ── helpers ───────────────────────────────────────────────────────── */

function nextClaimNo(db: MockDb, type: ClaimTypeKey): string {
  const prefix = claimConfig(type).prefix;
  const year = new Date().getFullYear();
  const used = db.claims.filter((c) =>
    c.claimNo.startsWith(`${prefix}-${year}-`)
  ).length;
  return `${prefix}-${year}-${String(used + 1).padStart(5, "0")}`;
}

function advance(
  db: MockDb,
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

  const account = db.accounts.find((a) => a.id === claim.accountId);
  if (account) {
    account.claimStatus = toAccountClaimStatus(status);
    if (
      status === "SUBMITTED" ||
      status === "DOCUMENTS_RESUBMITTED" ||
      status === "UNDER_REVIEW"
    ) {
      account.stage = "Under IMGC review";
    } else if (status === "APPROVED") {
      account.stage = "Claim approved";
    } else if (status === "REJECTED") {
      account.stage = "Claim rejected";
    } else if (status === "CLOSED") {
      account.stage = "Claim closed";
    } else if (status === "QUERY_RAISED") {
      account.stage = "Query raised with the lender";
    } else if (status === "REFUND_RECEIVED_BY_IMGC") {
      account.stage = "Refund received by IMGC";
    }
  }
}

/**
 * Keeps the Claim record's own status (and, for a query, its ClaimQuery row) in step with a
 * decision made from the legacy per-account Overview tab (`accounts.server.ts`'s `setClaimStatus`).
 *
 * That screen only ever wrote `account.claimStatus`; the Claim entity — what Track Claim, the
 * lender's workspace, and this claim's own status-history graph actually read — never moved, so
 * an approval made there was invisible everywhere else. This is the sync point, not a duplicate
 * decision path: it does not record its own audit event or notification — the caller already
 * does both for the account-level change, and doing it twice would double both up. When the
 * account has no open claim yet (a legacy-only account with nothing in `db.claims`), there is
 * nothing to sync and this is a no-op.
 */
export async function syncClaimForAccountDecision(
  session: AppSession,
  accountId: string,
  status: Extract<ClaimStatus, "APPROVED" | "QUERIED">,
  note: string
): Promise<void> {
  await writeDb((db) => {
    const claim = db.claims.find(
      (c) => c.accountId === accountId && !TERMINAL_STATUSES.has(c.status)
    );
    if (!claim) return;

    if (status === "APPROVED") {
      advance(db, claim, "APPROVED", session, note || undefined);
      claim.decision = {
        outcome: "APPROVED",
        byId: session.userId,
        byName: session.name,
        at: nowIso(),
        remarks: note,
      };
      return;
    }

    // "QUERIED" here is the account-level status; the claim's own vocabulary for the same event
    // is QUERY_RAISED, and Query Response is driven by there being a matching ClaimQuery row
    // (`openQuery` in claimFlow's `decorate()`) — so a query raised this way needs one too, or
    // the claim would show as queried with nothing for the lender to actually respond to.
    const raisedAt = nowIso();
    db.claimQueries.push({
      id: newId("qry"),
      claimId: claim.id,
      reason: note.trim() || "Query raised from the account review.",
      remarks: "",
      requestedDocuments: [],
      raisedById: session.userId,
      raisedByName: session.name,
      raisedAt,
      dueDate: new Date(
        new Date(raisedAt).getTime() + 4 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    claim.bucket = "LENDER";
    advance(db, claim, "QUERY_RAISED", session, note || undefined);
  });
}

/**
 * Keeps the Claim record in step with a document decision made through `claims.server.ts`'s
 * `decideDocument` — the legacy per-account checklist (Accounts' Initial Claims tab, and the
 * Additional Documents workbench, both go through it), which only ever wrote the shared
 * `ClaimDocument` row and never touched the Claim entity.
 *
 * A document rejected or sent back for re-upload is exactly the same "the lender has something
 * to fix" event a formal query is, so it gets one: a real `ClaimQuery` naming that document,
 * the claim moved to QUERY_RAISED. Without this, the row's own status pill said "Rejected" but
 * the claim's Progress rail and Query Response section had no idea anything had happened —
 * nothing told the lender there was something to act on. An approval needs no such sync; there
 * is nothing for the lender to do. Same non-duplicating contract as `syncClaimForAccountDecision`:
 * no audit event or notification here, the caller already sends both for the document decision.
 */
export async function syncQueryForDocumentDecision(
  session: AppSession,
  accountId: string,
  documentName: string,
  decision: "REJECTED" | "REUPLOAD_REQUESTED",
  note: string
): Promise<void> {
  await writeDb((db) => {
    const claim = db.claims.find(
      (c) => c.accountId === accountId && !TERMINAL_STATUSES.has(c.status)
    );
    if (!claim) return;

    const raisedAt = nowIso();
    db.claimQueries.push({
      id: newId("qry"),
      claimId: claim.id,
      reason:
        note.trim() ||
        (decision === "REJECTED"
          ? `"${documentName}" was rejected.`
          : `"${documentName}" needs to be re-uploaded.`),
      remarks: "",
      requestedDocuments: [documentName],
      raisedById: session.userId,
      raisedByName: session.name,
      raisedAt,
      dueDate: new Date(
        new Date(raisedAt).getTime() + 4 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    claim.bucket = "LENDER";
    advance(db, claim, "QUERY_RAISED", session, note || undefined);
  });
}

/* ── lender actions ────────────────────────────────────────────────── */

/**
 * Start a claim, materialising the configured checklist as real document rows.
 *
 * The checklist is copied from config at creation rather than read live, so changing the config
 * later cannot silently alter what an in-flight claim was asked for.
 */
/**
 * Turn a claim type's document config into real checklist rows for one claim.
 *
 * Conditional documents are always materialised, but `required` reflects whether the rule held
 * against the loan data — so a not-applicable conditional document sits in the list as optional
 * and does not block submission.
 *
 * For INITIAL claims, the first two documents (Property Documents and Legal & Collection Feedback)
 * are pre-seeded as already available — simulating documents that the customer supplied at loan
 * sourcing before claim initiation. Both receive an UNDER_REVIEW DocumentFile record pointing at
 * a real demo PDF in public/demo/, so View Document and Replace work through the same existing
 * /api/portal/files/[fileId] route as any normally-uploaded file.
 */
function materialiseChecklist(
  fresh: MockDb,
  claimId: string,
  accountId: string,
  claimType: ClaimTypeKey
): void {
  const account = fresh.accounts.find((a) => a.id === accountId);
  const loan = (account ?? {}) as unknown as Record<string, unknown>;

  /** Stable demo PDF paths — resolved at runtime so the path is valid wherever cwd lands. */
  const DEMO_FILES: Record<
    number,
    { name: string; file: string; size: number }
  > = {
    0: {
      name: "property-documents.pdf",
      file: path.join(
        process.cwd(),
        "public",
        "demo",
        "property-documents.pdf"
      ),
      size: 214_990,
    },
    1: {
      name: "legal-collection-feedback.pdf",
      file: path.join(
        process.cwd(),
        "public",
        "demo",
        "legal-collection-feedback.pdf"
      ),
      size: 184_320,
    },
  };

  claimConfig(claimType).documents.forEach((spec, i) => {
    const applies = docConditionMet(spec.condition, loan);
    const docId = `${claimId}_doc${i}`;

    // For INITIAL claims, the first two documents are pre-existing: they were submitted by the
    // customer during loan sourcing. We seed them as UNDER_REVIEW with a real DocumentFile so
    // the existing ClaimDocuments UI naturally shows View / Replace, and summariseDocs() counts
    // them as satisfied without any change to validation logic.
    const demoEntry = claimType === "INITIAL" ? DEMO_FILES[i] : undefined;
    const fileId = demoEntry ? `${docId}_f1` : undefined;

    if (demoEntry && fileId) {
      fresh.documentFiles.push({
        id: fileId,
        documentId: docId,
        accountId,
        originalName: demoEntry.name,
        storedPath: demoEntry.file,
        size: demoEntry.size,
        mime: "application/pdf",
        // Uploaded by "system" to represent a customer-sourced document, not the current lender.
        uploadedBy: "system",
        uploadedByName: "Customer (Pre-Loaded)",
        // Dated 7 days before claim creation to signal pre-existence.
        uploadedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        version: 1,
      });
    }

    fresh.claimDocuments.push({
      id: docId,
      accountId,
      claimId,
      slug: spec.slug,
      name: spec.name,
      category: spec.category,
      description: spec.description,
      required: spec.required && applies,
      multiple: spec.multiple ?? false,
      conditional: Boolean(spec.condition),
      conditionReason: spec.condition
        ? conditionReason(spec.condition)
        : undefined,
      addedBy: "SYSTEM",
      // Pre-seeded docs land in UNDER_REVIEW (uploaded, awaiting IMGC approval) — the same state
      // a normal upload produces (see uploadDocument()), so validation and UI treat them
      // identically to a document the lender uploaded themselves.
      status: demoEntry ? "UNDER_REVIEW" : "PENDING_UPLOAD",
      version: demoEntry ? 1 : 0,
      currentFileId: fileId,
      active: true,
      createdAt: nowIso(),
    });
  });
}

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
      error:
        "A claim can only be raised once the account is NPA or written off.",
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

    materialiseChecklist(fresh, claimId, accountId, claimType);
  });

  // No audit entry here: the workspace calls this on every visit so there's a claim to attach
  // documents to, but merely opening the page isn't a business event worth logging — only an
  // explicit save is (see `saveClaimDraft`'s "Claim draft saved" entry).
  return { ok: true, claimId };
}

/**
 * Change a draft claim's type.
 *
 * Only while DRAFT: the type decides the field set and the checklist, and both are already
 * materialised. Switching rebuilds the checklist from the new config and drops field values that
 * the new type does not have; anything still valid is kept.
 */
export async function switchClaimType(
  session: AppSession,
  claimId: string,
  newType: ClaimTypeKey
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;

  const outcome = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false as const, error: "Claim not found." };
    if (claim.status !== "DRAFT") {
      return {
        ok: false as const,
        error: "The claim type can only change while it is a draft.",
      };
    }
    if (claim.claimType === newType)
      return { ok: true as const, changed: false };

    const config = claimConfig(newType);
    const validIds = new Set(config.fields.map((f) => f.id));
    claim.claimType = newType;
    // The claim has never left draft, so no one has referenced its number yet — reissue it
    // with the new type's prefix so CLM/CLS/CLA matches the type on screen.
    claim.claimNo = nextClaimNo(db, newType);
    claim.fields = Object.fromEntries(
      Object.entries(claim.fields).filter(([k]) => validIds.has(k))
    );
    claim.lastUpdatedAt = nowIso();

    // Rebuild the system checklist from the new config. Lender-added additional documents are
    // kept — they belong to the claim, not the type.
    db.claimDocuments = db.claimDocuments.filter(
      (d) => d.claimId !== claimId || d.addedBy === "LENDER"
    );
    materialiseChecklist(db, claimId, claim.accountId, newType);
    return { ok: true as const, changed: true, accountId: claim.accountId };
  });
  if (!outcome.ok) return outcome;

  if (outcome.changed) {
    await recordEvent({
      accountId: guard.accountId as string,
      actor: session,
      type: "CLAIM_STATUS_CHANGED",
      summary: `Claim type changed to ${claimConfig(newType).label}`,
      meta: { claimId, claimType: newType },
    });
  }
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
    claim.draftSaved = true;

    // A query response draft is not a workflow transition. In particular, submitClaim calls this
    // helper before it records the successful QUERY_RAISED -> UNDER_REVIEW transition, so adding a
    // same-status history entry here would create a duplicate QUERY_RAISED event.
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
    .filter(
      (f) =>
        f.required &&
        fieldVisible(f, values) &&
        !String(values[f.id] ?? "").trim()
    )
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
      check.missingFields.length
        ? `fields: ${check.missingFields.join(", ")}`
        : "",
      check.missingDocuments.length
        ? `documents: ${check.missingDocuments.join(", ")}`
        : "",
    ].filter(Boolean);
    return { ok: false, error: `Still outstanding — ${parts.join("; ")}.` };
  }

  const {
    claimNo,
    bucketChangedFrom,
    accountId,
    account,
    initiationRemarkAdded,
  } = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim)
      return {
        claimNo: "",
        bucketChangedFrom: null,
        accountId: "",
        account: null,
        initiationRemarkAdded: false,
      };
    // Answering a query resubmits; a first submission submits. Both land with IMGC.
    const resubmitting = claim.status === "QUERY_RAISED";
    advance(
      db,
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
        open.responseRemarks =
          fields.__queryResponse ??
          claim.fields.__queryResponse ??
          "Documents resubmitted.";
      }
      delete claim.fields.__queryResponse;
      // Rule: a resubmission goes straight back into review.
      advance(db, claim, "UNDER_REVIEW", session, "Resubmission received");
    }

    let bucketChangedFrom = null;
    const account = db.accounts.find((a) => a.id === claim.accountId);
    if (account && account.bucket !== "IMGC") {
      bucketChangedFrom = account.bucket;
      account.bucket = "IMGC";
    }

    const initiationRemark = claim.fields.__initiationRemark?.trim();
    const initiationRemarkAdded =
      !resubmitting &&
      Boolean(initiationRemark) &&
      !db.remarks.some(
        (remark) =>
          remark.claimId === claim.id && remark.source === "CLAIM_INITIATION"
      );
    if (initiationRemarkAdded) {
      db.remarks.unshift({
        id: newId("rmk"),
        accountId: claim.accountId,
        claimId: claim.id,
        source: "CLAIM_INITIATION",
        authorId: session.userId,
        authorName: session.name,
        authorRole: session.role,
        body: initiationRemark!,
        createdAt: nowIso(),
      });
    }

    return {
      claimNo: claim.claimNo,
      bucketChangedFrom,
      accountId: claim.accountId,
      account: account ? { ...account } : null,
      initiationRemarkAdded,
    };
  });

  await recordEvent({
    accountId: guard.accountId!,
    actor: session,
    type: "CLAIM_SUBMITTED",
    summary: `Claim ${claimNo} submitted to IMGC`,
    meta: { claimId },
  });

  if (initiationRemarkAdded) {
    await recordEvent({
      accountId: guard.accountId!,
      actor: session,
      type: "REMARK_ADDED",
      summary: "Lender added an initiation remark",
      meta: { claimId, source: "CLAIM_INITIATION" },
    });
  }

  if (bucketChangedFrom) {
    await recordEvent({
      accountId: accountId,
      actor: session,
      type: "BUCKET_SHIFTED",
      summary: `Account moved from the ${bucketChangedFrom} bucket to the IMGC bucket`,
      meta: { from: bucketChangedFrom, to: "IMGC" },
    });
    if (account) {
      await notifyBucketShift(account, bucketChangedFrom, "IMGC", session);
    }
  }
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
    advance(db, claim, status, session, remarks || undefined);
    if (status === "APPROVED" || status === "REJECTED" || status === "CLOSED") {
      claim.decision = {
        outcome: status,
        byId: session.userId,
        byName: session.name,
        at: nowIso(),
        remarks,
      };
    }
    return {
      ok: true as const,
      accountId: claim.accountId,
      claimNo: claim.claimNo,
    };
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
  return { ok: true, claimId, accountId: outcome.accountId };
}

/**
 * "Refund Received" — IMGC recording that money for an already-approved claim has actually
 * reached them. Nothing more: no refund initiation, no invoice, no lender-side processing, no
 * payment gateway, no second decision. `claim.decision` (the original APPROVED outcome) is left
 * exactly as it was; this only appends one more real entry to `statusHistory`.
 *
 * The guard on `claim.status !== "APPROVED"` is what makes duplicate clicks and duplicate status
 * updates impossible server-side (requirement, not just a disabled button): the first successful
 * call moves the claim to REFUND_RECEIVED_BY_IMGC, so every call after that — a second click that
 * slipped past the disabled button, two tabs open, a replayed request — fails this check instead
 * of writing a second entry.
 */
export async function markRefundReceived(
  session: AppSession,
  claimId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false as const, error: "Claim not found." };
    if (claim.status !== "APPROVED") {
      return {
        ok: false as const,
        error:
          claim.status === "REFUND_RECEIVED_BY_IMGC"
            ? "The refund for this claim has already been recorded."
            : "Only an approved claim can be marked as refund received.",
      };
    }
    advance(db, claim, "REFUND_RECEIVED_BY_IMGC", session);
    return {
      ok: true as const,
      accountId: claim.accountId,
      claimNo: claim.claimNo,
    };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId: outcome.accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Refund received by IMGC for claim ${outcome.claimNo}`,
    meta: { claimId, status: "REFUND_RECEIVED_BY_IMGC" },
  });
  // The lender sees this everywhere the claim's status already renders (Track Claim, their own
  // claim workspace, the Claims grid) — this notification is the push on top of that, same
  // pattern `updateClaimStatus` uses for every other decision.
  await notify(outcome.accountId, {
    subject: `Claim ${outcome.claimNo} — refund received by IMGC`,
    body: `${session.name} confirmed the refund for claim ${outcome.claimNo} has been received by IMGC.`,
    event: "CLAIM_STATUS_CHANGED",
    unreadFor: ["LENDER"],
  });
  return { ok: true, claimId, accountId: outcome.accountId };
}

export async function raiseQuery(
  session: AppSession,
  claimId: string,
  input: { reason: string; remarks: string; requestedDocuments: string[] }
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  if (!input.reason.trim())
    return { ok: false, error: "A query needs a reason." };

  const outcome = await writeDb((db) => {
    const claim = db.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false as const, error: "Claim not found." };
    if (TERMINAL_STATUSES.has(claim.status)) {
      return { ok: false as const, error: "That claim is already closed." };
    }

    const raisedAt = nowIso();
    db.claimQueries.push({
      id: newId("qry"),
      claimId,
      reason: input.reason.trim(),
      remarks: input.remarks.trim(),
      requestedDocuments: input.requestedDocuments,
      raisedById: session.userId,
      raisedByName: session.name,
      raisedAt,
      // Standard 4-day response window — not user-set, so it can't be forgotten or fudged.
      dueDate: new Date(
        new Date(raisedAt).getTime() + 4 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    // A requested document goes back to the lender to provide again.
    for (const name of input.requestedDocuments) {
      const doc = db.claimDocuments.find(
        (d) => d.claimId === claimId && d.name === name
      );
      if (doc) doc.status = "REUPLOAD_REQUIRED";
    }

    advance(db, claim, "QUERY_RAISED", session, input.reason.trim());
    claim.bucket = "LENDER";

    let bucketChangedFrom = null;
    const account = db.accounts.find((a) => a.id === claim.accountId);
    if (account && account.bucket !== "LENDER") {
      bucketChangedFrom = account.bucket;
      account.bucket = "LENDER";
    }

    return {
      ok: true as const,
      accountId: claim.accountId,
      claimNo: claim.claimNo,
      bucketChangedFrom,
      account: account ? { ...account } : null,
    };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId: outcome.accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Query raised on ${outcome.claimNo} — ${input.reason.trim()}`,
    meta: { claimId },
  });

  if (outcome.bucketChangedFrom) {
    await recordEvent({
      accountId: outcome.accountId,
      actor: session,
      type: "BUCKET_SHIFTED",
      summary: `Account moved from the ${outcome.bucketChangedFrom} bucket to the LENDER bucket`,
      meta: { from: outcome.bucketChangedFrom, to: "LENDER" },
    });
    if (outcome.account) {
      await notifyBucketShift(
        outcome.account,
        outcome.bucketChangedFrom,
        "LENDER",
        session
      );
    }
  }

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
  return { ok: true, claimId, accountId: outcome.accountId };
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
  if (
    session.role !== "LENDER" ||
    account.lenderOrgId !== session.lenderOrgId
  ) {
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
  return { ok: true, claimId, accountId: claim.accountId };
}

/* ── lender-added additional documents ─────────────────────────────── */

/**
 * A document the lender adds themselves, beyond the configured checklist.
 *
 * Modelled as a `ClaimDocument` with `addedBy: "LENDER"` and `required: false` — it uses the
 * same upload, review, versioning and remark machinery as every other claim document, and it
 * never touches the type's configuration. Added one at a time; there is no limit.
 */
export async function addLenderDocument(
  session: AppSession,
  claimId: string,
  input: { name: string; description: string; remarks: string; file: File }
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the document a name." };
  if (!input.file || input.file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (input.file.size > 15 * 1024 * 1024) {
    return { ok: false, error: "That file is larger than 15 MB." };
  }

  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return { ok: false, error: "Claim not found." };
  if (TERMINAL_STATUSES.has(claim.status)) {
    return { ok: false, error: "This claim is closed." };
  }
  const accountId = claim.accountId;

  const existingAd = db.claimDocuments.filter(
    (d) => d.claimId === claimId && d.addedBy === "LENDER"
  ).length;
  const clash = db.claimDocuments.some(
    (d) => d.claimId === claimId && d.name.toLowerCase() === name.toLowerCase()
  );
  if (clash)
    return {
      ok: false,
      error: "A document with that name is already on this claim.",
    };

  const docId = newId("addoc");
  const refNo = `AD-${String(existingAd + 1).padStart(3, "0")}`;
  const fileId = newId("file");
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  // Same shared-storage seam the checklist upload uses.
  const storedPath = await putUpload(
    accountId,
    `${fileId}__${safeName}`,
    Buffer.from(await input.file.arrayBuffer()),
    input.file.type || "application/octet-stream"
  );

  await writeDb((fresh) => {
    fresh.claimDocuments.push({
      id: docId,
      accountId,
      claimId,
      refNo,
      name,
      category: "Additional Document",
      description: input.description.trim() || undefined,
      required: false,
      multiple: false,
      addedBy: "LENDER",
      addedByName: session.name,
      status: "UNDER_REVIEW",
      version: 1,
      currentFileId: fileId,
      active: true,
      createdAt: nowIso(),
    });
    fresh.documentFiles.push({
      id: fileId,
      documentId: docId,
      accountId,
      originalName: input.file.name,
      storedPath,
      size: input.file.size,
      mime: input.file.type || "application/octet-stream",
      uploadedBy: session.userId,
      uploadedByName: session.name,
      uploadedAt: nowIso(),
      version: 1,
      uploadRemarks: input.remarks.trim() || undefined,
    });
    if (input.remarks.trim()) {
      fresh.remarks.unshift({
        id: newId("rmk"),
        accountId,
        documentId: docId,
        authorId: session.userId,
        authorName: session.name,
        authorRole: session.role,
        body: input.remarks.trim(),
        createdAt: nowIso(),
      });
    }
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_UPLOADED",
    summary: `Additional document added: "${name}" (${refNo})`,
    meta: { document: name, refNo },
  });
  return { ok: true, claimId };
}

/**
 * Set the remark on one claim document.
 *
 * Upserts a single remark row for this author + document, so the per-category remark box behaves
 * as one editable field rather than an ever-growing thread. Document remarks are kept distinct
 * from claim-level and loan remarks.
 */
export async function upsertDocumentRemark(
  session: AppSession,
  claimId: string,
  documentId: string,
  body: string
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;
  const text = body.trim();

  const db = await readDb();
  const doc = db.claimDocuments.find(
    (d) => d.id === documentId && d.claimId === claimId
  );
  if (!doc) return { ok: false, error: "Document not found." };

  await writeDb((fresh) => {
    fresh.remarks = fresh.remarks.filter(
      (r) =>
        !(
          r.documentId === documentId &&
          r.authorId === session.userId &&
          r.accountId === guard.accountId
        )
    );
    if (text) {
      fresh.remarks.unshift({
        id: newId("rmk"),
        accountId: guard.accountId as string,
        documentId,
        authorId: session.userId,
        authorName: session.name,
        authorRole: session.role,
        body: text,
        createdAt: nowIso(),
      });
    }
  });

  await recordEvent({
    accountId: guard.accountId as string,
    actor: session,
    type: "REMARK_ADDED",
    summary: `Remark on "${doc.name}": ${text || "(cleared)"}`,
    meta: { document: doc.name },
  });
  return { ok: true, claimId };
}
