import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { readDb, writeDb, UPLOAD_DIR } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import { syncQueryForDocumentDecision } from "@/services/portal/claimFlow.server";
import {
  notifyBucketShift,
  notifyClaimSubmitted,
  notifyDocumentDecision,
  notifyDocumentUploaded,
  notifyRequirementAdded,
} from "@/services/portal/notifications.server";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  Bucket,
  ClaimDocument,
  DocStatus,
  DocumentFile,
  Priority,
} from "@/server/mock/types";

export interface DocumentRow extends ClaimDocument {
  file?: DocumentFile;
  history: DocumentFile[];
}

type Outcome = { ok: true } | { ok: false; error: string };

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** A lender may only touch accounts belonging to their own org. */
async function assertAccess(
  session: AppSession,
  accountId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Account not found." };
  if (session.role === "LENDER" && account.lenderOrgId !== session.lenderOrgId) {
    return { ok: false, error: "This account belongs to another lender." };
  }
  return { ok: true };
}

export async function listDocuments(
  session: AppSession,
  accountId: string
): Promise<DocumentRow[]> {
  const access = await assertAccess(session, accountId);
  if (!access.ok) return [];

  const db = await readDb();
  return db.claimDocuments
    .filter((d) => d.accountId === accountId)
    // A withdrawn requirement is no longer being asked for, so the lender does not see it at
    // all. IMGC keeps it visible (greyed) — they withdrew it and may want it back.
    .filter((d) => session.role === "IMGC" || isActive(d))
    .map((d) => ({
      ...d,
      file: db.documentFiles.find((f) => f.id === d.currentFileId),
      history: db.documentFiles
        .filter((f) => f.documentId === d.id)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    }))
    // Required first, then alphabetical — the checklist reads as a to-do list.
    .sort((a, b) =>
      a.required === b.required ? a.name.localeCompare(b.name) : a.required ? -1 : 1
    );
}

/** BRD: IMGC can add a requirement (e.g. NOC) that the lender then uploads against. */
export interface RequirementInput {
  name: string;
  category: string;
  description: string;
  required: boolean;
  applicableProduct: string;
  applicableCaseType: string;
  /** ISO date, or "" for no SLA. */
  dueDate: string;
  remarks: string;
  active: boolean;
  priority: Priority;
}

/**
 * BRD: IMGC adds a document to the required list for a case, and the lender then uploads against
 * it. Everything past the name is configuration the lender reads — the category groups the row,
 * the description tells them what to actually provide, and the due date is what makes an
 * outstanding requirement chase itself.
 */
export async function addRequirement(
  session: AppSession,
  accountId: string,
  input: RequirementInput
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "Give the document a name." };
  if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) {
    return { ok: false, error: "That due date is not a valid date." };
  }

  const created = await writeDb((db) => {
    const clash = db.claimDocuments.some(
      (d) => d.accountId === accountId && d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) return false;
    db.claimDocuments.push({
      id: newId("doc"),
      accountId,
      name: trimmed,
      required: input.required,
      addedBy: "IMGC",
      addedByName: session.name,
      status: "PENDING_UPLOAD",
      createdAt: nowIso(),
      category: input.category.trim() || undefined,
      description: input.description.trim() || undefined,
      applicableProduct: input.applicableProduct.trim() || undefined,
      applicableCaseType: input.applicableCaseType.trim() || undefined,
      dueDate: input.dueDate || undefined,
      requirementRemarks: input.remarks.trim() || undefined,
      active: input.active,
      priority: input.priority,
      version: 0,
    });
    return true;
  });

  if (!created) return { ok: false, error: "That document is already on the list." };

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_REQUIREMENT_ADDED",
    summary:
      `Document requirement added: "${trimmed}"` +
      `${input.required ? " (mandatory)" : " (optional)"}` +
      `${input.category ? ` · ${input.category}` : ""}` +
      `${input.dueDate ? ` · due ${new Date(input.dueDate).toLocaleDateString("en-IN")}` : ""}` +
      `${input.active ? "" : " · inactive"}`,
    meta: {
      document: trimmed,
      category: input.category,
      required: String(input.required),
      dueDate: input.dueDate,
      active: String(input.active),
    },
  });

  if (input.active) {
    const db = await readDb();
    const account = db.accounts.find((a) => a.id === accountId);
    if (account) await notifyRequirementAdded(account, trimmed, session);
  }
  return { ok: true };
}

/**
 * Withdraw or restore a requirement.
 *
 * Deactivating is not deleting: the row and anything already uploaded against it stay for the
 * audit trail, but the lender stops being asked for it and it stops holding up submission. A
 * requirement raised in error would otherwise block the claim with no way out but deletion,
 * which would take the history with it.
 */
export async function setRequirementActive(
  session: AppSession,
  accountId: string,
  documentId: string,
  active: boolean
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const doc = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!doc) return { ok: false as const, error: "Requirement not found." };
    if (doc.addedBy !== "IMGC") {
      return { ok: false as const, error: "Only an added requirement can be withdrawn." };
    }
    doc.active = active;
    return { ok: true as const, name: doc.name };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_REQUIREMENT_ADDED",
    summary: `Requirement "${outcome.name}" ${active ? "reactivated" : "withdrawn (inactive)"}`,
    meta: { document: outcome.name, active: String(active) },
  });
  return { ok: true };
}

export interface UploadMeta {
  documentNumber?: string;
  documentDate?: string;
  remarks?: string;
}

export async function uploadDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  file: File,
  meta: UploadMeta = {}
): Promise<Outcome> {
  const access = await assertAccess(session, accountId);
  if (!access.ok) return access;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That file is larger than 15 MB." };
  }

  const db = await readDb();
  const doc = db.claimDocuments.find((d) => d.id === documentId && d.accountId === accountId);
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status === "APPROVED") {
    return { ok: false, error: "That document has already been approved." };
  }
  if (doc.active === false) {
    return { ok: false, error: "That requirement has been withdrawn." };
  }

  const fileId = newId("file");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const dir = path.join(UPLOAD_DIR, accountId);
  const storedPath = path.join(dir, `${fileId}__${safeName}`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

  const version = await writeDb((fresh) => {
    const row = fresh.claimDocuments.find((d) => d.id === documentId);
    if (!row) return 0;
    const next = (row.version ?? 0) + 1;

    // A multi-file category keeps every file it is given. A single-file one supersedes the
    // previous version — never deleting it — and carries the reason it was replaced so the
    // history reads as a conversation rather than a pile of files.
    if (!row.multiple) {
      for (const f of fresh.documentFiles) {
        if (f.documentId === documentId && !f.supersededAt) {
          f.supersededAt = nowIso();
          f.supersededReason = row.review?.remarks;
        }
      }
    }
    fresh.documentFiles.push({
      id: fileId,
      documentId,
      accountId,
      originalName: file.name,
      storedPath,
      size: file.size,
      mime: file.type || "application/octet-stream",
      uploadedBy: session.userId,
      uploadedByName: session.name,
      uploadedAt: nowIso(),
      version: next,
      documentNumber: meta.documentNumber?.trim() || undefined,
      documentDate: meta.documentDate || undefined,
      uploadRemarks: meta.remarks?.trim() || undefined,
    });
    row.currentFileId = fileId;
    row.version = next;
    // Rules 2 and 6 — an upload, first or replacement, goes straight into review.
    row.status = "UNDER_REVIEW";
    // A fresh upload answers the last decision, so the retention clock stops and the old
    // decision no longer describes what is on the row.
    row.rejection = undefined;
    row.review = undefined;
    return next;
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_UPLOADED",
    summary: `"${doc.name}" uploaded — version ${version} (${file.name})`,
    meta: { document: doc.name, file: file.name, version: String(version) },
  });

  const fresh = await readDb();
  const account = fresh.accounts.find((a) => a.id === accountId);
  const org = fresh.lenderOrgs.find((o) => o.id === account?.lenderOrgId);
  if (account) {
    await notifyDocumentUploaded(
      account,
      doc.name,
      version,
      session,
      org?.name ?? "the lender"
    );
  }
  return { ok: true };
}

export type ReviewDecision = "APPROVED" | "REJECTED" | "REUPLOAD_REQUESTED";

/**
 * The review engine: the single place a document's status changes as a result of an IMGC
 * decision.
 *
 * Rejection and a re-upload request both demand remarks — the lender's only route back is to act
 * on what the reviewer said, and a decision with no reason gives them nothing to act on. Approval
 * does not, because "approved" needs no explanation.
 */
export async function decideDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  decision: ReviewDecision,
  remarks: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const note = remarks.trim();
  if (decision === "REJECTED" && !note) {
    return { ok: false, error: "A rejection needs a reason." };
  }
  if (decision === "REUPLOAD_REQUESTED" && !note) {
    return { ok: false, error: "Say what the lender needs to correct." };
  }

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Document not found." };
    if (row.active === false) {
      return { ok: false as const, error: "That requirement has been withdrawn." };
    }
    if (!row.currentFileId) {
      return { ok: false as const, error: "Nothing has been uploaded to review yet." };
    }

    // Rule 3/4/5 — the decision is the status.
    row.status = decision === "REUPLOAD_REQUESTED" ? "REUPLOAD_REQUIRED" : decision;
    row.review = {
      decision,
      by: session.userId,
      byName: session.name,
      at: nowIso(),
      remarks: note,
      version: row.version ?? 1,
    };
    // The retention clock is only for an outright rejection; a re-upload request expects the
    // lender to come back, so nothing is being retired.
    row.rejection =
      decision === "REJECTED"
        ? { at: nowIso(), by: session.name, reason: note }
        : undefined;
    return { ok: true as const, name: row.name, version: row.version ?? 1 };
  });
  if (!outcome.ok) return outcome;

  const TYPES = {
    APPROVED: "DOC_APPROVED",
    REJECTED: "DOC_REJECTED",
    REUPLOAD_REQUESTED: "DOC_REUPLOAD_REQUESTED",
  } as const;
  const VERBS = {
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REUPLOAD_REQUESTED: "Re-upload requested",
  } as const;

  await recordEvent({
    accountId,
    actor: session,
    type: TYPES[decision],
    summary: `${VERBS[decision]} — "${outcome.name}" v${outcome.version}${note ? ` — ${note}` : ""}`,
    meta: {
      document: outcome.name,
      status: decision,
      version: String(outcome.version),
      remarks: note,
    },
  });

  // A rejection or a re-upload request is the lender's to fix — sync it into the Claim entity as
  // a real query, or the claim's own Progress rail and Query Response section never learn this
  // happened at all (see `syncQueryForDocumentDecision`).
  if (decision === "REJECTED" || decision === "REUPLOAD_REQUESTED") {
    await syncQueryForDocumentDecision(
      session,
      accountId,
      outcome.name,
      decision,
      note
    );
  }

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyDocumentDecision(account, outcome.name, decision, note, session);
  }
  return { ok: true };
}

/**
 * IMGC undoes their own rejection directly — the same reset a lender's reinstatement request
 * grants once approved (`decideReinstate`), just without making them ask for it first. For when
 * the rejection itself was the mistake, not the document.
 */
export async function reactivateDocument(
  session: AppSession,
  accountId: string,
  documentId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Document not found." };
    if (row.status !== "REJECTED") {
      return { ok: false as const, error: "That document isn't rejected." };
    }
    row.status = row.currentFileId ? "UNDER_REVIEW" : "PENDING_UPLOAD";
    row.rejection = undefined;
    return { ok: true as const, name: row.name };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_REACTIVATED",
    summary: `Rejection undone — "${outcome.name}" is back under review`,
    meta: { document: outcome.name },
  });
  return { ok: true };
}

/**
 * Manually raises the query a rejection should already carry — for a document rejected before
 * `decideDocument` started syncing one automatically, so it sits "Rejected" with nothing on the
 * claim's own Progress rail or Query Response to show for it. A fresh rejection never needs
 * this; the caller only offers the button when no query already names the document.
 */
export async function raiseQueryForRejectedDocument(
  session: AppSession,
  accountId: string,
  documentId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const db = await readDb();
  const row = db.claimDocuments.find(
    (d) => d.id === documentId && d.accountId === accountId
  );
  if (!row) return { ok: false, error: "Document not found." };
  if (row.status !== "REJECTED" || !row.rejection) {
    return { ok: false, error: "That document isn't rejected." };
  }

  await syncQueryForDocumentDecision(
    session,
    accountId,
    row.name,
    "REJECTED",
    row.rejection.reason
  );

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Query raised for "${row.name}" — ${row.rejection.reason}`,
    meta: { document: row.name },
  });
  return { ok: true };
}

/** Enabled only when every mandatory document is uploaded or already accepted. */
/**
 * Submission unlocks only once every mandatory document is in.
 *
 * Withdrawn requirements are excluded: an inactive row is not being asked for, and leaving it in
 * the count would hold the claim shut on a document nobody wants.
 */
export function canSubmit(docs: DocumentRow[]): boolean {
  const required = docs.filter((d) => d.required && isActive(d));
  return (
    required.length > 0 &&
    required.every((d) => d.status === "UNDER_REVIEW" || d.status === "APPROVED")
  );
}

/** Requirements predate the `active` flag, so absent means active. */
export function isActive(doc: { active?: boolean }): boolean {
  return doc.active !== false;
}

export async function submitClaim(
  session: AppSession,
  accountId: string
): Promise<Outcome> {
  const access = await assertAccess(session, accountId);
  if (!access.ok) return access;

  const docs = await listDocuments(session, accountId);
  if (!canSubmit(docs)) {
    return { ok: false, error: "Every mandatory document must be uploaded first." };
  }

  let bucketChangedFrom: Bucket | null = null;
  const updateOutcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const };
    
    if (account.bucket !== "IMGC") {
      bucketChangedFrom = account.bucket;
      account.bucket = "IMGC";
    }
    
    account.claimStatus = "SUBMITTED";
    account.submittedAt = nowIso();
    account.stage = "Submitted to IMGC";
    
    return { ok: true as const };
  });
  
  if (!updateOutcome.ok) return { ok: true };

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_SUBMITTED",
    summary: `Initial claim submitted with ${docs.filter((d) => d.required).length} mandatory documents`,
  });
  
  if (bucketChangedFrom) {
    await recordEvent({
      accountId,
      actor: session,
      type: "BUCKET_SHIFTED",
      summary: `Account moved from the ${bucketChangedFrom} bucket to the IMGC bucket`,
      meta: { from: bucketChangedFrom, to: "IMGC" },
    });
  }

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    if (bucketChangedFrom) {
      await notifyBucketShift(account, bucketChangedFrom, "IMGC", session);
    }
    await notifyClaimSubmitted(account, session);
  }
  return { ok: true };
}

/* ── rejected-document reinstatement ───────────────────────────────── */

export async function requestReinstate(
  session: AppSession,
  accountId: string,
  documentId: string,
  note: string
): Promise<Outcome> {
  const access = await assertAccess(session, accountId);
  if (!access.ok) return access;

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find((d) => d.id === documentId);
    if (!row?.rejection) return { ok: false as const, error: "That document is not rejected." };
    if (row.rejection.reinstate?.status === "REQUESTED") {
      return { ok: false as const, error: "A reinstatement is already pending." };
    }
    row.rejection.reinstate = {
      status: "REQUESTED",
      requestedBy: session.name,
      requestedAt: nowIso(),
      note: note.trim() || undefined,
    };
    return { ok: true as const, name: row.name };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "REINSTATE_REQUESTED",
    summary: `Reinstatement requested for rejected document "${outcome.name}"`,
    meta: { document: outcome.name },
  });
  return { ok: true };
}

export async function decideReinstate(
  session: AppSession,
  accountId: string,
  documentId: string,
  approve: boolean,
  note: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find((d) => d.id === documentId);
    const reinstate = row?.rejection?.reinstate;
    if (!row || !reinstate) {
      return { ok: false as const, error: "No reinstatement was requested." };
    }
    reinstate.status = approve ? "APPROVED" : "DENIED";
    reinstate.decidedBy = session.name;
    reinstate.decidedAt = nowIso();
    if (note.trim()) reinstate.note = note.trim();

    if (approve) {
      // Back into play: the previously uploaded file stands again.
      row.status = row.currentFileId ? "UNDER_REVIEW" : "PENDING_UPLOAD";
      row.rejection = undefined;
    }
    return { ok: true as const, name: row.name };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "REINSTATE_DECIDED",
    summary: `Reinstatement ${approve ? "approved" : "denied"} for "${outcome.name}"${note.trim() ? ` — ${note.trim()}` : ""}`,
    meta: { document: outcome.name, decision: approve ? "APPROVED" : "DENIED" },
  });
  return { ok: true };
}

/* ── case document summary (rules 7 & 8) ───────────────────────────── */

export interface CaseDocSummary {
  requiredCount: number;
  approved: number;
  underReview: number;
  pending: number;
  reuploadRequired: number;
  rejected: number;
  /** Rule 7: every required document approved. Rule 8: anything else outstanding. */
  complete: boolean;
}

/**
 * Derived, never stored. A completion flag kept as its own column is a second source of truth
 * that goes stale the moment a status changes by any route that forgets to update it.
 */
export function summariseDocs(docs: DocumentRow[]): CaseDocSummary {
  const required = docs.filter((d) => d.required && isActive(d));
  const count = (s: DocStatus) => required.filter((d) => d.status === s).length;
  const approved = count("APPROVED");
  return {
    requiredCount: required.length,
    approved,
    underReview: count("UNDER_REVIEW"),
    pending: count("PENDING_UPLOAD") + count("NOT_REQUESTED"),
    reuploadRequired: count("REUPLOAD_REQUIRED"),
    rejected: count("REJECTED"),
    complete: required.length > 0 && approved === required.length,
  };
}

/* ── edit an existing requirement ──────────────────────────────────── */

/**
 * Edit the configuration of a requirement without disturbing what has been uploaded against it.
 *
 * Deliberately cannot change the document's status or its files: those belong to the workflow,
 * and letting an edit set them would give a second, unaudited route around the review engine.
 */
export async function updateRequirement(
  session: AppSession,
  accountId: string,
  documentId: string,
  input: RequirementInput
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "Give the document a name." };
  if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) {
    return { ok: false, error: "That due date is not a valid date." };
  }

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Requirement not found." };
    if (row.addedBy !== "IMGC") {
      return { ok: false as const, error: "The standard checklist cannot be edited." };
    }
    const clash = db.claimDocuments.some(
      (d) =>
        d.accountId === accountId &&
        d.id !== documentId &&
        d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) return { ok: false as const, error: "Another requirement already has that name." };

    row.name = trimmed;
    row.required = input.required;
    row.category = input.category.trim() || undefined;
    row.description = input.description.trim() || undefined;
    row.applicableProduct = input.applicableProduct.trim() || undefined;
    row.applicableCaseType = input.applicableCaseType.trim() || undefined;
    row.dueDate = input.dueDate || undefined;
    row.requirementRemarks = input.remarks.trim() || undefined;
    row.priority = input.priority;
    row.active = input.active;
    return { ok: true as const };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_REQUIREMENT_UPDATED",
    summary: `Requirement updated: "${trimmed}"${input.required ? " (mandatory)" : " (optional)"}`,
    meta: { document: trimmed },
  });
  return { ok: true };
}
