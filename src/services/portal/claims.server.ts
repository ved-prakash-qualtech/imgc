import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { readDb, writeDb, UPLOAD_DIR } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import {
  notifyClaimSubmitted,
  notifyDocumentDecision,
} from "@/services/portal/notifications.server";
import type { AppSession } from "@/lib/auth/appSession";
import type { ClaimDocument, DocumentFile } from "@/server/mock/types";

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
export async function addRequirement(
  session: AppSession,
  accountId: string,
  name: string,
  required: boolean
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the document a name." };

  const created = await writeDb((db) => {
    const clash = db.claimDocuments.some(
      (d) => d.accountId === accountId && d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) return false;
    db.claimDocuments.push({
      id: newId("doc"),
      accountId,
      name: trimmed,
      required,
      addedBy: "IMGC",
      status: "PENDING",
      createdAt: nowIso(),
    });
    return true;
  });

  if (!created) return { ok: false, error: "That document is already on the list." };

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_REQUIREMENT_ADDED",
    summary: `Document requirement added: "${trimmed}"${required ? " (mandatory)" : " (optional)"}`,
    meta: { document: trimmed },
  });
  return { ok: true };
}

export async function uploadDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  file: File
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
  if (doc.status === "ACCEPTED") {
    return { ok: false, error: "That document has already been accepted." };
  }

  const fileId = newId("file");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const dir = path.join(UPLOAD_DIR, accountId);
  const storedPath = path.join(dir, `${fileId}__${safeName}`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

  await writeDb((fresh) => {
    const row = fresh.claimDocuments.find((d) => d.id === documentId);
    if (!row) return;
    for (const f of fresh.documentFiles) {
      if (f.documentId === documentId && !f.supersededAt) f.supersededAt = nowIso();
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
    });
    row.currentFileId = fileId;
    row.status = "UPLOADED";
    // A fresh upload answers a rejection, so the retention clock stops.
    row.rejection = undefined;
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_UPLOADED",
    summary: `"${doc.name}" uploaded (${file.name})`,
    meta: { document: doc.name, file: file.name },
  });
  return { ok: true };
}

export async function decideDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  decision: "ACCEPTED" | "REJECTED",
  reason: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  if (decision === "REJECTED" && !reason.trim()) {
    return { ok: false, error: "A rejection needs a reason." };
  }

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Document not found." };
    if (row.status === "PENDING") {
      return { ok: false as const, error: "Nothing has been uploaded yet." };
    }
    row.status = decision;
    row.rejection =
      decision === "REJECTED"
        ? { at: nowIso(), by: session.name, reason: reason.trim() }
        : undefined;
    return { ok: true as const, name: row.name };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_STATUS_CHANGED",
    summary: `"${outcome.name}" marked ${decision}${reason.trim() ? ` — ${reason.trim()}` : ""}`,
    meta: { document: outcome.name, status: decision },
  });

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyDocumentDecision(account, outcome.name, decision, reason.trim(), session);
  }
  return { ok: true };
}

/** Enabled only when every mandatory document is uploaded or already accepted. */
export function canSubmit(docs: DocumentRow[]): boolean {
  const required = docs.filter((d) => d.required);
  return (
    required.length > 0 &&
    required.every((d) => d.status === "UPLOADED" || d.status === "ACCEPTED")
  );
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

  await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return;
    account.claimStatus = "SUBMITTED";
    account.submittedAt = nowIso();
    account.stage = "Submitted to IMGC";
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_SUBMITTED",
    summary: `Initial claim submitted with ${docs.filter((d) => d.required).length} mandatory documents`,
  });

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) await notifyClaimSubmitted(account, session);
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
      row.status = row.currentFileId ? "UPLOADED" : "PENDING";
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
