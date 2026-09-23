import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import {
  storeIncomingUpload,
  type IncomingUpload,
} from "@/server/mock/storage";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import {
  configuredOrder,
  syncQueryForDocumentDecision,
} from "@/services/portal/claimFlow.server";
import {
  notifyBucketShift,
  notifyClaimSubmitted,
  notifyDocumentDecision,
  notifyDocumentUploaded,
  notifyReinstateDecision,
  notifyReinstateRequested,
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
  files: DocumentFile[];
  history: DocumentFile[];
}

type Outcome = { ok: true } | { ok: false; error: string };

/** A lender may only touch accounts belonging to their own org. */
async function assertAccess(
  session: AppSession,
  accountId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Account not found." };
  if (
    session.role === "LENDER" &&
    account.lenderOrgId !== session.lenderOrgId
  ) {
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
  const account = db.accounts.find((a) => a.id === accountId);
  const claim = db.claims.find((c) => c.accountId === accountId);
  const rank = configuredOrder(
    db,
    claim?.claimType ?? "INITIAL",
    account?.lenderOrgId
  );
  return (
    db.claimDocuments
      .filter((d) => d.accountId === accountId)
      // A withdrawn requirement is no longer being asked for, so the lender does not see it at
      // all. IMGC keeps it visible (greyed) — they withdrew it and may want it back.
      .filter((d) => session.role === "IMGC" || isActive(d))
      .map((d) => {
        const history = db.documentFiles
          .filter((f) => f.documentId === d.id)
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        const hasPendingSave = history.some((f) => f.pendingSave);
        const visibleFiles = history.filter((f) => {
          if (session.role === "IMGC") {
            if (f.pendingSave) return false;
            // If the lender has unsubmitted replacements, keep showing IMGC the old rejected file.
            if (hasPendingSave && f.supersededAt && f.review?.decision === "REJECTED") return true;
          }
          return !f.supersededAt;
        });
        const statusForImgc =
          session.role === "IMGC" && visibleFiles.length !== history.filter((f) => !f.supersededAt).length
            ? deriveDocumentStatus(visibleFiles)
            : d.status;
            
        return {
          ...d,
          status: statusForImgc,
          file: visibleFiles[0],
          files: visibleFiles,
          history,
        };
      })
      // Mandatory first, then the order IMGC set in Document Configuration — the same order the
      // lender sees, so both sides walk the checklist identically. Anything the configuration does
      // not know (IMGC or lender additions) follows, alphabetically.
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        const ar = rank(a),
          br = rank(b);
        return ar !== br ? ar - br : a.name.localeCompare(b.name);
      })
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
      (d) =>
        d.accountId === accountId &&
        d.name.toLowerCase() === trimmed.toLowerCase()
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

  if (!created)
    return { ok: false, error: "That document is already on the list." };

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
      return {
        ok: false as const,
        error: "Only an added requirement can be withdrawn.",
      };
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
  replaceFileId?: string;
}

export async function uploadDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  incoming: IncomingUpload,
  meta: UploadMeta = {}
): Promise<Outcome> {
  const access = await assertAccess(session, accountId);
  if (!access.ok) return access;

  const db = await readDb();
  const doc = db.claimDocuments.find(
    (d) => d.id === documentId && d.accountId === accountId
  );
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status === "APPROVED") {
    return { ok: false, error: "That document has already been approved." };
  }
  if (doc.active === false) {
    return { ok: false, error: "That requirement has been withdrawn." };
  }

  const fileId = newId("file");
  // Shared object storage on a deployment, the local disk in development — `storedPath` is
  // whatever locator that backend hands back (a URL or an absolute path), and the file route
  // reads either kind. A file the browser already uploaded to Blob is verified, not re-sent.
  const stored = await storeIncomingUpload(accountId, fileId, incoming);
  if (!stored.ok) return stored;
  const upload = stored.file;

  const version = await writeDb((fresh) => {
    const row = fresh.claimDocuments.find((d) => d.id === documentId);
    if (!row) return 0;
    const next = (row.version ?? 0) + 1;

    // File-level supersession: if the lender clicked Re-upload on a specific rejected file,
    // supersede only that file.
    if (meta.replaceFileId) {
      const target = fresh.documentFiles.find(
        (f) => f.id === meta.replaceFileId && f.documentId === documentId
      );
      if (target && !target.supersededAt) {
        target.supersededAt = nowIso();
        target.supersededReason = row.review?.remarks;
      }
    }

    // Reupload on a rejected document (no specific file named) answers the rejection: the
    // rejected files are replaced by the new one. Left live, they kept the document Rejected
    // even after IMGC accepted the new upload.
    if (
      !meta.replaceFileId &&
      (row.status === "REJECTED" || row.status === "REUPLOAD_REQUIRED")
    ) {
      for (const f of fresh.documentFiles) {
        if (
          f.documentId === documentId &&
          !f.supersededAt &&
          f.review?.decision === "REJECTED"
        ) {
          f.supersededAt = nowIso();
          f.supersededReason = f.review.remarks;
        }
      }
    }

    fresh.documentFiles.push({
      id: fileId,
      documentId,
      accountId,
      originalName: upload.originalName,
      storedPath: upload.storedPath,
      size: upload.size,
      mime: upload.mime,
      uploadedBy: session.userId,
      uploadedByName: session.name,
      uploadedByRole: session.role,
      uploadedAt: nowIso(),
      version: next,
      documentNumber: meta.documentNumber?.trim() || undefined,
      documentDate: meta.documentDate || undefined,
      uploadRemarks: meta.remarks?.trim() || undefined,
      pendingSave:
        session.role === "LENDER" &&
        fresh.claims.some(
          (c) =>
            c.id === row.claimId &&
            (c.status === "DRAFT" || c.status === "QUERY_INITIATED" || c.status === "QUERY_UNDER_REVIEW")
        )
          ? true
          : undefined,
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
    summary: `"${doc.name}" uploaded — version ${version} (${upload.originalName})`,
    meta: {
      document: doc.name,
      file: upload.originalName,
      version: String(version),
      fileId,
      // Only when there is one: the audit meta holds strings, and an absent remark is an absent
      // key rather than an empty one.
      ...(meta.remarks?.trim() ? { remarks: meta.remarks.trim() } : {}),
    },
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

/**
 * Remove a single uploaded file from a document category.
 *
 * The file is soft-deleted by setting `supersededAt`, preserving the audit trail. If the
 * deleted file was the `currentFileId`, the row's pointer advances to the most-recently-uploaded
 * remaining active file, or clears if there are none left (putting the category back to
 * PENDING_UPLOAD so the lender can upload again).
 *
 * Only the document's owning lender may call this; IMGC cannot delete on their behalf.
 */
export async function deleteDocumentFile(
  session: AppSession,
  accountId: string,
  documentId: string,
  fileId: string
): Promise<Outcome> {
  if (session.role !== "LENDER") {
    return { ok: false, error: "Only the lender may delete uploaded files." };
  }

  const access = await assertAccess(session, accountId);
  if (!access.ok) return access;

  const db = await readDb();
  const doc = db.claimDocuments.find((d) => d.id === documentId);
  if (!doc) return { ok: false, error: "Document not found." };

  // Draft-only, and checked here rather than trusted from the screen that hides the button: once
  // the claim is submitted the file is part of what IMGC is reviewing, and removing it would take
  // evidence out of a review already under way. A wrong file is replaced by uploading over it,
  // which supersedes it and leaves the old version in the audit trail.
  if (doc.claimId) {
    const claim = db.claims.find((c) => c.id === doc.claimId);
    if (claim && claim.status !== "DRAFT") {
      return {
        ok: false,
        error:
          "This claim has been submitted — upload a new version instead of deleting the file.",
      };
    }
  }

  const fileRow = db.documentFiles.find(
    (f) => f.id === fileId && f.documentId === documentId
  );
  if (!fileRow) return { ok: false, error: "File not found." };
  if (fileRow.supersededAt)
    return { ok: false, error: "File already removed." };

  const fileName = fileRow.originalName;
  const docName = doc.name;

  await writeDb((fresh) => {
    const row = fresh.claimDocuments.find((d) => d.id === documentId);
    if (!row) return;
    const target = fresh.documentFiles.find(
      (f) => f.id === fileId && f.documentId === documentId
    );
    if (!target || target.supersededAt) return;

    // Soft-delete: stamp supersededAt so it falls out of `files` (active-only view).
    target.supersededAt = nowIso();
    target.supersededReason = "Deleted by lender.";

    // Advance the document pointer to the next-newest remaining active file, if any.
    const remaining = fresh.documentFiles
      .filter((f) => f.documentId === documentId && !f.supersededAt)
      .sort((a, b) => b.version - a.version);

    if (remaining.length > 0) {
      const [first] = remaining;
      row.currentFileId = first!.id;
      row.version = first!.version;
      // Keep the status as UNDER_REVIEW if there are still files awaiting review.
      if (row.status !== "APPROVED") row.status = "UNDER_REVIEW";
    } else {
      // No remaining files — reset to pending so lender can re-upload.
      row.currentFileId = undefined;
      row.version = 0;
      row.status = "PENDING_UPLOAD";
      row.review = undefined;
    }
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_UPLOADED",
    summary: `\"${docName}\" — file deleted: ${fileName}`,
    meta: { document: docName, file: fileName, fileId, action: "deleted" },
  });

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
  if (decision === "APPROVED" && !note) {
    return { ok: false, error: "Add a remark before accepting the document." };
  }
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
      return {
        ok: false as const,
        error: "That requirement has been withdrawn.",
      };
    }
    if (!row.currentFileId) {
      return {
        ok: false as const,
        error: "Nothing has been uploaded to review yet.",
      };
    }

    // A whole-requirement decision is the same decision on each of its live files, so the
    // per-file view and the requirement never disagree about where things stand.
    if (decision === "APPROVED" || decision === "REJECTED") {
      const review = {
        decision,
        by: session.userId,
        byName: session.name,
        at: nowIso(),
        remarks: note,
      };
      for (const file of db.documentFiles) {
        if (file.documentId !== row.id || file.supersededAt) continue;
        file.review = review;
        file.reviews = [...(file.reviews ?? []), review];
      }
    }

    // Rule 3/4/5 — the decision is the status.
    row.status =
      decision === "REUPLOAD_REQUESTED" ? "REUPLOAD_REQUIRED" : decision;
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

  // `decision` is the closed `ReviewDecision` union and both maps are `as const` over exactly
  // those three keys, so there is no arbitrary key to inject — the rule cannot see the type.
  /* eslint-disable security/detect-object-injection */
  const auditType = TYPES[decision];
  const auditVerb = VERBS[decision];
  /* eslint-enable security/detect-object-injection */

  await recordEvent({
    accountId,
    actor: session,
    type: auditType,
    summary: `${auditVerb} — "${outcome.name}" v${outcome.version}${note ? ` — ${note}` : ""}`,
    meta: {
      document: outcome.name,
      status: decision,
      version: String(outcome.version),
      remarks: note,
    },
  });

  // A rejection no longer raises a query by itself: the claim's status stays where it is until
  // IMGC deliberately clicks "Queried". The reason is on the file for the lender to read.

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyDocumentDecision(
      account,
      outcome.name,
      decision,
      note,
      session
    );
  }
  return { ok: true };
}

/* ── per-file review ───────────────────────────────────────────────── */

/**
 * A requirement's status, read off its live files.
 *
 * Several files can sit under one requirement, and IMGC decides each one separately. The
 * requirement is only as far along as its least-settled file: anything still undecided keeps it
 * under review, one rejected file makes it rejected (the lender has something to fix), and it is
 * approved only when every file is. Derived rather than stored separately, so a file decision can
 * never leave the requirement saying something its files do not.
 */
export function deriveDocumentStatus(
  files: ReadonlyArray<Pick<DocumentFile, "review">>
): DocStatus {
  if (files.length === 0) return "PENDING_UPLOAD";
  // A rejection takes priority over an undecided file sitting alongside it: a multi-file
  // requirement (several bank statements, several ID pages) needs the lender's action the moment
  // any one of them is rejected, whether or not IMGC has gotten to the others yet. Checking
  // "still under review" first used to hide the rejection entirely — the requirement read as
  // "Uploaded" with no way to reupload for as long as a sibling file stayed undecided.
  if (files.some((f) => f.review?.decision === "REJECTED")) return "REJECTED";
  if (files.some((f) => !f.review)) return "UNDER_REVIEW";
  return "APPROVED";
}

/** Re-derives a requirement from its live files after one of them changed. */
function applyDerivedStatus(
  db: { documentFiles: DocumentFile[] },
  row: ClaimDocument,
  session: AppSession,
  remarks: string
): DocStatus {
  const live = db.documentFiles.filter(
    (f) => f.documentId === row.id && !f.supersededAt
  );
  const status = deriveDocumentStatus(live);
  const previous = row.status;
  row.status = status;

  // The requirement's remark is the one that explains its status: when it is rejected, that is
  // the latest rejected file's reason — not whatever file happened to be decided last, which may
  // well be an acceptance on another file.
  const rejected = live
    .filter((f) => f.review?.decision === "REJECTED")
    .sort((a, b) => (b.review?.at ?? "").localeCompare(a.review?.at ?? ""))[0];
  const explaining = status === "REJECTED" ? (rejected?.review ?? null) : null;
  const reason = explaining?.remarks ?? remarks;

  if (status === "APPROVED" || status === "REJECTED") {
    row.review = {
      decision: status,
      by: explaining?.by ?? session.userId,
      byName: explaining?.byName ?? session.name,
      at: explaining?.at ?? nowIso(),
      remarks: reason,
      version: row.version ?? 1,
    };
  } else {
    row.review = undefined;
  }

  // The 90-day retention clock belongs to a rejection. Start it when the requirement first turns
  // rejected, keep it running while it stays rejected, and stop it the moment it is not.
  if (status === "REJECTED") {
    if (previous !== "REJECTED" || !row.rejection) {
      row.rejection = {
        at: nowIso(),
        by: explaining?.byName ?? session.name,
        reason,
      };
    } else {
      // Still rejected, clock keeps running — but the reason follows the current rejected file.
      row.rejection.reason = reason;
    }
  } else {
    row.rejection = undefined;
  }
  return status;
}

/**
 * IMGC accepts or rejects ONE file.
 *
 * The remark is mandatory for both decisions — an acceptance is a judgement too, and the lender
 * reads the remark either way. It is appended to the file's own history rather than overwriting
 * the last one, so what was said about an earlier version stays on the record.
 */
export async function decideFile(
  session: AppSession,
  accountId: string,
  documentId: string,
  fileId: string,
  decision: "APPROVED" | "REJECTED",
  remarks: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const note = remarks.trim();
  if (!note && decision === "REJECTED") {
    return {
      ok: false,
      error: "Add a reason before rejecting the file.",
    };
  }

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Document not found." };
    if (row.active === false) {
      return {
        ok: false as const,
        error: "That requirement has been withdrawn.",
      };
    }
    const file = db.documentFiles.find(
      (f) => f.id === fileId && f.documentId === documentId
    );
    if (!file || file.supersededAt) {
      return { ok: false as const, error: "That file is no longer current." };
    }

    const review = {
      decision,
      by: session.userId,
      byName: session.name,
      at: nowIso(),
      remarks: note,
    };
    file.review = review;
    file.reviews = [...(file.reviews ?? []), review];

    const status = applyDerivedStatus(db, row, session, note);
    return {
      ok: true as const,
      name: row.name,
      fileName: file.originalName,
      status,
    };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: decision === "APPROVED" ? "DOC_APPROVED" : "DOC_REJECTED",
    summary: `${decision === "APPROVED" ? "Accepted" : "Rejected"} file "${outcome.fileName}" on "${outcome.name}" — ${note}`,
    meta: {
      document: outcome.name,
      file: outcome.fileName,
      fileId,
      status: decision,
      documentStatus: outcome.status,
      remarks: note,
    },
  });

  // A rejection no longer raises a query by itself: the claim's status stays where it is until
  // IMGC deliberately clicks "Queried". The reason is on the file for the lender to read.

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyDocumentDecision(
      account,
      `${outcome.name} (${outcome.fileName})`,
      decision,
      note,
      session
    );
  }
  return { ok: true };
}

/**
 * IMGC takes back their own decision on one file — it goes back to awaiting review. The history
 * keeps the decision that was undone; only the current one is cleared.
 */
export async function undoFileDecision(
  session: AppSession,
  accountId: string,
  documentId: string,
  fileId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const row = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!row) return { ok: false as const, error: "Document not found." };
    const file = db.documentFiles.find(
      (f) => f.id === fileId && f.documentId === documentId
    );
    if (!file || file.supersededAt) {
      return { ok: false as const, error: "That file is no longer current." };
    }
    if (!file.review) {
      return {
        ok: false as const,
        error: "That file has no decision to undo.",
      };
    }
    const undone = file.review.decision;
    file.review = undefined;
    applyDerivedStatus(db, row, session, "");
    return {
      ok: true as const,
      name: row.name,
      fileName: file.originalName,
      undone,
    };
  });
  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_STATUS_CHANGED",
    summary: `Undid ${outcome.undone === "APPROVED" ? "acceptance" : "rejection"} of file "${outcome.fileName}" on "${outcome.name}". Back under review.`,
    meta: { document: outcome.name, file: outcome.fileName, fileId },
  });
  return { ok: true };
}

/**
 * IMGC undoes their own acceptance — the document goes back under review.
 * Only applies to documents that are currently ACCEPTED (or APPROVED).
 */
export async function undoAcceptedDocument(
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
    if (row.active === false) {
      return {
        ok: false as const,
        error: "That requirement has been withdrawn.",
      };
    }
    if (row.status !== "APPROVED") {
      return { ok: false as const, error: "Document is not accepted." };
    }

    row.status = "UNDER_REVIEW";
    return { ok: true as const, name: row.name, version: row.version ?? 1 };
  });

  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_STATUS_CHANGED",
    summary: `Undid acceptance for "${outcome.name}" v${outcome.version}. Back under review.`,
    meta: { document: outcome.name, decision: "UNDO_ACCEPTANCE" },
  });

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
    required.every(
      (d) => d.status === "UNDER_REVIEW" || d.status === "APPROVED"
    )
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
    return {
      ok: false,
      error: "Every mandatory document must be uploaded first.",
    };
  }

  let bucketChangedFrom: Bucket | null = null;
  const updateOutcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const };

    if (account.bucket !== "IMGC") {
      bucketChangedFrom = account.bucket;
      account.bucket = "IMGC";
    }

    account.claimStatus = "UNDER_REVIEW";
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
    if (!row?.rejection)
      return { ok: false as const, error: "That document is not rejected." };
    if (row.rejection.reinstate?.status === "REQUESTED") {
      return {
        ok: false as const,
        error: "A reinstatement is already pending.",
      };
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

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyReinstateRequested(account, outcome.name, note.trim(), session);
  }
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

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) {
    await notifyReinstateDecision(
      account,
      outcome.name,
      approve,
      note.trim(),
      session
    );
  }
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
 *
 * Structural, not `DocumentRow[]`, on purpose: `setClaimStatus` needs to run this over a claim's
 * own checklist (`RequirementRow[]`, from `listClaimDocuments`) once a claim exists, not the
 * account's full document table — see the caller.
 */
export function summariseDocs(
  docs: ReadonlyArray<{
    required: boolean;
    status: DocStatus;
    active?: boolean;
  }>
): CaseDocSummary {
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
      return {
        ok: false as const,
        error: "The standard checklist cannot be edited.",
      };
    }
    const clash = db.claimDocuments.some(
      (d) =>
        d.accountId === accountId &&
        d.id !== documentId &&
        d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash)
      return {
        ok: false as const,
        error: "Another requirement already has that name.",
      };

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

/**
 * Removes a Draft claim's uploads that Save Draft never kept — the lender left Initiate Claim
 * (another tab, Back, a refresh, a closed tab) without saving.
 */
export async function discardUnsavedUploads(
  session: AppSession,
  accountId: string,
  claimId: string
): Promise<Outcome> {
  if (session.role !== "LENDER") return { ok: true };
  const db = await readDb();
  const docIds = new Set(
    db.claimDocuments.filter((d) => d.claimId === claimId).map((d) => d.id)
  );
  const pending = db.documentFiles.filter(
    (f) => f.pendingSave && !f.supersededAt && docIds.has(f.documentId)
  );
  for (const f of pending) {
    await deleteDocumentFile(session, accountId, f.documentId, f.id);
  }
  return { ok: true };
}

/**
 * IMGC only — archives a rejection so it is kept on record and never purged.
 *
 * `fileId` addresses a rejected file the lender has since replaced. Its document has moved back
 * under review, so there is no document-level rejection left to flag — the pin goes on the file's
 * own review, which is the only place that rejection still exists.
 */
export async function archiveRejectedDocument(
  session: AppSession,
  accountId: string,
  documentId: string,
  fileId?: string
): Promise<Outcome> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const outcome = await writeDb((db) => {
    if (fileId) {
      const file = db.documentFiles.find(
        (f) => f.id === fileId && f.accountId === accountId
      );
      if (!file || file.review?.decision !== "REJECTED") {
        return {
          ok: false as const,
          error: "Only a rejected file can be archived.",
        };
      }
      if (file.review.archived)
        return { ok: false as const, error: "Already archived." };
      file.review.archived = { at: nowIso(), by: session.name };
      return { ok: true as const, name: file.originalName };
    }

    const doc = db.claimDocuments.find(
      (d) => d.id === documentId && d.accountId === accountId
    );
    if (!doc || doc.status !== "REJECTED" || !doc.rejection) {
      return {
        ok: false as const,
        error: "Only a rejected document can be archived.",
      };
    }
    if (doc.rejection.archived)
      return { ok: false as const, error: "Already archived." };
    doc.rejection.archived = { at: nowIso(), by: session.name };
    return { ok: true as const, name: doc.name };
  });
  if (!outcome.ok) return outcome;
  await recordEvent({
    accountId,
    actor: session,
    type: "DOC_ARCHIVED",
    summary: `Rejected document "${outcome.name}" archived — kept on record`,
    meta: fileId ? { documentId, fileId } : { documentId },
  });
  return { ok: true };
}
