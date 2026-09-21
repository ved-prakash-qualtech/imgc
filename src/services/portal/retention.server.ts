import "server-only";

import { readDb } from "@/server/mock/db";
import {
  RETENTION_DAYS,
  daysLeft,
  isHeld,
  sweepExpiredRejections,
} from "@/server/mock/retention";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  ClaimDocument,
  DocumentFile,
  Rejection,
} from "@/server/mock/types";

export { RETENTION_DAYS, sweepExpiredRejections };

export interface RejectedDocRow extends ClaimDocument {
  rejection: Rejection;
  accountLoanNo: string;
  borrowerName: string;
  lenderOrgName: string;
  daysLeft: number;
  held: boolean;
  /** Unique per row: the document id, or the replaced file's id for a replaced row. */
  rowKey: string;
  /** Set when this row is a rejected file the lender has since replaced by a re-upload — kept
   *  visible here so the rejection stays on record. */
  replaced?: { fileId: string; fileName: string; at: string };
  /**
   * The file the rejection was actually about. This screen exists to hold document history, so
   * it always names the version IMGC rejected — never a newer one the lender uploaded after the
   * fact, which is a different file that nobody has rejected.
   */
  rejectedFile?: {
    id: string;
    name: string;
    version: number;
    uploadedAt: string;
    superseded: boolean;
  };
}

/**
 * Which file a rejection was about.
 *
 * Preference order matters: an explicit per-file REJECTED review is the fact, so it wins. Older
 * seed data recorded the rejection on the document alone, and there the rejected file is whichever
 * version was live *at the moment of rejection* — so candidates uploaded after `rejectedAt` are
 * excluded rather than falling back to "the newest file", which is exactly the replacement this
 * screen must never present as the rejected document.
 */
function rejectedFileFor(
  files: readonly DocumentFile[],
  rejectedAt: string
): DocumentFile | undefined {
  const reviewed = files
    .filter((f) => f.review?.decision === "REJECTED")
    .sort((a, b) => (b.review?.at ?? "").localeCompare(a.review?.at ?? ""));
  if (reviewed.length > 0) return reviewed[0];

  return files
    .filter((f) => f.uploadedAt <= rejectedAt)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
}

/**
 * Rejected documents still inside the retention window, newest rejection first.
 *
 * Claim documents only. A document IMGC raised against the account itself carries no `claimId`,
 * is on no claim's checklist, and has no screen that can open it — listing it here gave a row
 * nobody could act on. Retention is reviewed against the claim it belongs to.
 */
export async function listRejectedDocuments(
  session: AppSession
): Promise<RejectedDocRow[]> {
  const db = await readDb();
  const accounts = db.accounts.filter(
    (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
  );
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const filesByDoc = new Map<string, DocumentFile[]>();
  for (const f of db.documentFiles) {
    const list = filesByDoc.get(f.documentId);
    if (list) list.push(f);
    else filesByDoc.set(f.documentId, [f]);
  }

  const current: RejectedDocRow[] = db.claimDocuments
    .filter(
      (d): d is ClaimDocument & { rejection: Rejection } =>
        Boolean(d.rejection) &&
        d.status === "REJECTED" &&
        Boolean(d.claimId) &&
        byId.has(d.accountId)
    )
    .map((d) => {
      const account = byId.get(d.accountId)!;
      const file = rejectedFileFor(filesByDoc.get(d.id) ?? [], d.rejection.at);
      return {
        ...d,
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        lenderOrgName:
          db.lenderOrgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
        daysLeft: daysLeft(d.rejection.at),
        held: isHeld(d),
        rowKey: d.id,
        rejectedFile: file && {
          id: file.id,
          name: file.originalName,
          version: file.version,
          uploadedAt: file.uploadedAt,
          superseded: Boolean(file.supersededAt),
        },
      };
    });

  // Rejected files the lender replaced with a re-upload. The document itself has moved on (it is
  // back under review), but the rejection and the file it was about stay listed.
  const docsById = new Map(
    db.claimDocuments
      .filter((d) => Boolean(d.claimId) && byId.has(d.accountId))
      .map((d) => [d.id, d])
  );
  const replaced: RejectedDocRow[] = db.documentFiles.flatMap((f) => {
    const d = docsById.get(f.documentId);
    if (!d || !f.supersededAt || f.review?.decision !== "REJECTED") return [];
    const account = byId.get(d.accountId)!;
    return [
      {
        ...d,
        rejection: {
          at: f.review.at,
          by: f.review.byName,
          reason: f.review.remarks || f.supersededReason || "—",
          // Archiving a replaced row pins the *file*, so surface that through the same field the
          // document-level rows use — the screen then needs no second notion of "archived".
          archived: f.review.archived,
        },
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        lenderOrgName:
          db.lenderOrgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
        daysLeft: daysLeft(f.review.at),
        // The sweep only purges documents still sitting at REJECTED; a replaced file's document
        // has moved back under review, so nothing will ever purge it.
        held: true,
        rowKey: f.id,
        replaced: {
          fileId: f.id,
          fileName: f.originalName,
          at: f.supersededAt,
        },
        rejectedFile: {
          id: f.id,
          name: f.originalName,
          version: f.version,
          uploadedAt: f.uploadedAt,
          superseded: true,
        },
      },
    ];
  });

  return [...current, ...replaced].sort((a, b) =>
    b.rejection.at.localeCompare(a.rejection.at)
  );
}
