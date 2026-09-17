/* eslint-disable use-client/browser-api */
import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import {
  storeIncomingUpload,
  type IncomingUpload,
} from "@/server/mock/storage";
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
  type ClaimDocumentSpec,
} from "@/config/claimConfig";
import { summariseDocs } from "@/services/portal/claims.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";
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
  claimNo?: string;
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
    // A draft claim is only the workspace's attachment point. Claim numbers are issued at
    // Save & Submit, so clear any stale number left by an older mock snapshot before it reaches
    // the lender grid.
    claimNo: claim.status === "DRAFT" ? "" : claim.claimNo,
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
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "DOCUMENTS_RESUBMITTED",
]);

export interface ClaimOverviewCounts {
  total: number;
  initiation: number;
  underReview: number;
  approved: number;
  rejected: number;
  draft: number;
  initiated: number;
  queried: number;
  queryInitiated: number;
  queryUnderReview: number;
  /** Claims IMGC has confirmed the refund for (`REFUND_RECEIVED_BY_IMGC`) — a subset of
   *  `approved`, not a sixth mutually-exclusive outcome, so it stays counted there too. */
  refunded: number;
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
  rows: ReadonlyArray<{
    claim: { status: ClaimStatus; hasProgress?: boolean } | null;
  }>
): ClaimOverviewCounts {
  let initiation = 0;
  let underReview = 0;
  let approved = 0;
  let rejected = 0;
  let draft = 0;
  let initiated = 0;
  let queryInitiated = 0;
  let queryUnderReview = 0;
  let refunded = 0;
  let docsResubmitted = 0;

  for (const row of rows) {
    const status = row.claim?.status;
    const isNotStarted = !row.claim || !row.claim.hasProgress;

    if (isNotStarted) {
      initiation += 1;
    } else if (status === "INITIATED") {
      initiated += 1;
    } else if (status === "UNDER_REVIEW") {
      underReview += 1;
    } else if (status === "QUERY_INITIATED") {
      queryInitiated += 1;
    } else if (status === "QUERY_UNDER_REVIEW" || status === "QUERY_RAISED") {
      queryUnderReview += 1; // QUERY_RAISED is legacy fallback
    } else if (status === "DOCUMENTS_RESUBMITTED") {
      docsResubmitted += 1;
    } else if (
      status === "APPROVED" ||
      status === "CLOSED" ||
      status === "REFUND_RECEIVED_BY_IMGC"
    ) {
      approved += 1;
      if (status === "REFUND_RECEIVED_BY_IMGC") refunded += 1;
    } else if (status === "REJECTED") {
      rejected += 1;
    } else if (status === "DRAFT") {
      draft += 1;
    }
  }

  const queried = queryInitiated + queryUnderReview;

  return {
    total: initiation + draft + initiated + underReview + queried + docsResubmitted + approved + rejected,
    initiation,
    underReview,
    approved,
    rejected,
    draft,
    initiated,
    queried,
    queryInitiated,
    queryUnderReview,
    refunded,
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
    if (status === "DOCUMENTS_RESUBMITTED" || status === "UNDER_REVIEW") {
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
  status: Extract<ClaimStatus, "APPROVED" | "QUERIED" | "REJECTED">,
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

    if (status === "REJECTED") {
      advance(db, claim, "REJECTED", session, note || undefined);
      claim.decision = {
        outcome: "REJECTED",
        byId: session.userId,
        byName: session.name,
        at: nowIso(),
        remarks: note,
      };
      return;
    }

    // "QUERIED" here is the account-level status. Route to the correct claim-level status based
    // on where the claim currently sits: pre-review queries become QUERY_INITIATED; post-review
    // queries become QUERY_UNDER_REVIEW. Legacy QUERY_RAISED is preserved for any existing records
    // but is not produced by new raises through this path.
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
    const queryStatus: ClaimStatus =
      claim.status === "INITIATED" ? "QUERY_INITIATED" : "QUERY_UNDER_REVIEW";
    advance(db, claim, queryStatus, session, note || undefined);
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
    const docQueryStatus: ClaimStatus =
      claim.status === "INITIATED" ? "QUERY_INITIATED" : "QUERY_UNDER_REVIEW";
    advance(db, claim, docQueryStatus, session, note || undefined);
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
 * Every document starts empty (PENDING_UPLOAD): nothing is pre-uploaded on the lender's behalf.
 */
/**
 * The checklist a new claim is built from — the claim type's own default documents, unless the
 * lender has a saved "Lender Document Configuration" (IMGC's own admin page, over on
 * `lenderDocumentConfig.server.ts`), which only ever applies to INITIAL claims and only replaces
 * the list when that lender actually has rows saved. Any lender with none configured gets the
 * exact same default checklist this always produced — the feature is additive, never a change to
 * a lender nobody has configured.
 */
function documentSpecsFor(
  fresh: MockDb,
  claimType: ClaimTypeKey,
  lenderOrgId: string | undefined
): readonly ClaimDocumentSpec[] {
  if (claimType === "INITIAL" && lenderOrgId) {
    const custom = fresh.lenderDocumentRequirements
      .filter((r) => r.lenderOrgId === lenderOrgId)
      .sort((a, b) => a.order - b.order);
    if (custom.length > 0) {
      return custom.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: r.category,
        description: r.description,
        required: r.required,
      }));
    }
  }
  return claimConfig(claimType).documents;
}

function materialiseChecklist(
  fresh: MockDb,
  claimId: string,
  accountId: string,
  claimType: ClaimTypeKey
): void {
  const account = fresh.accounts.find((a) => a.id === accountId);
  const loan = (account ?? {}) as unknown as Record<string, unknown>;

  documentSpecsFor(fresh, claimType, account?.lenderOrgId).forEach(
    (spec, i) => {
      const applies = docConditionMet(spec.condition, loan);
      const docId = `${claimId}_doc${i}`;

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
        status: "PENDING_UPLOAD",
        version: 0,
        active: true,
        createdAt: nowIso(),
      });
    }
  );
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
      claimNo: "",
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
    claim.claimNo = "";
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
    const resubmittingInitiated = claim.status === "QUERY_INITIATED";
    const resubmittingUnderReview = claim.status === "QUERY_UNDER_REVIEW";
    const resubmittingLegacy = claim.status === "QUERY_RAISED";
    const resubmitting = resubmittingInitiated || resubmittingUnderReview || resubmittingLegacy;

    // Fresh initial submission only — resubmissions get their single advance inside the
    // if(resubmitting) block below, so we must not advance here too (would produce a duplicate
    // history entry e.g. UNDER_REVIEW → UNDER_REVIEW after a QUERY_UNDER_REVIEW response).
    if (!resubmitting) {
      advance(db, claim, "INITIATED", session);
    }
    if (!claim.claimNo) {
      claim.claimNo = nextClaimNo(db, claim.claimType);
    }
    if (!claim.submittedAt) {
      claim.submittedAt = nowIso();
      const acc = db.accounts.find((a) => a.id === claim.accountId);
      if (acc && !acc.submittedAt) acc.submittedAt = claim.submittedAt;
    }
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
      // Pre-review response (QUERY_INITIATED) returns to INITIATED so IMGC can Submit for Review.
      // Post-review response (QUERY_UNDER_REVIEW / legacy QUERY_RAISED) returns to UNDER_REVIEW.
      // Exactly one advance fires here — the duplicate above has been removed.
      if (resubmittingInitiated) {
        advance(db, claim, "INITIATED", session, "Query response received");
      } else {
        advance(db, claim, "UNDER_REVIEW", session, "Resubmission received");
      }
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
  return { ok: true, claimId, claimNo };
}

export async function startClaimReview(
  session: AppSession,
  accountId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const claimIdLookup = await writeDb((db) => {
    const claim = db.claims.find((c) => c.accountId === accountId);
    return claim ? claim.id : "";
  });
  
  if (!claimIdLookup) return { ok: false, error: "Claim not found." };
  
  const docs = await listClaimDocuments(session, claimIdLookup);
  const summary = summariseDocs(docs);
  if (!summary.complete) {
    return {
      ok: false,
      error: "Please approve all required documents before submitting the claim for review.",
    };
  }

  const { claimId, account } = await writeDb((db) => {
    const claim = db.claims.find((c) => c.accountId === accountId);
    if (!claim) return { claimId: "", account: null };
    if (claim.status !== "INITIATED") return { claimId: claim.id, account: null };

    advance(db, claim, "UNDER_REVIEW", session, "Review started");

    const account = db.accounts.find((a) => a.id === claim.accountId);
    return { claimId: claim.id, account };
  });

  if (!claimId || !account) return { ok: false, error: "Claim not found or not in Initiated status." };

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: "Claim review started",
    meta: { status: "UNDER_REVIEW", from: "INITIATED" },
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

    let targetStatus: ClaimStatus = "QUERY_UNDER_REVIEW";
    if (claim.status === "INITIATED") {
      targetStatus = "QUERY_INITIATED";
    }
    advance(db, claim, targetStatus, session, input.reason.trim());
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
  input: {
    name: string;
    description: string;
    remarks: string;
    file: IncomingUpload;
  }
): Promise<Outcome> {
  const guard = await assertLenderOwns(session, claimId);
  if (!guard.ok) return guard;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the document a name." };

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
  // Same shared-storage seam the checklist upload uses.
  const stored = await storeIncomingUpload(accountId, fileId, input.file);
  if (!stored.ok) return stored;
  const upload = stored.file;

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
      originalName: upload.originalName,
      storedPath: upload.storedPath,
      size: upload.size,
      mime: upload.mime,
      uploadedBy: session.userId,
      uploadedByName: session.name,
      uploadedByRole: session.role,
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
