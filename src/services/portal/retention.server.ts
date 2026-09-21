import "server-only";

import { readDb } from "@/server/mock/db";
import {
  RETENTION_DAYS,
  daysLeft,
  isHeld,
  sweepExpiredRejections,
} from "@/server/mock/retention";
import type { AppSession } from "@/lib/auth/appSession";
import type { ClaimDocument, Rejection } from "@/server/mock/types";

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

  const current: RejectedDocRow[] = db.claimDocuments
    .filter((d): d is ClaimDocument & { rejection: Rejection } =>
      Boolean(d.rejection) &&
      d.status === "REJECTED" &&
      Boolean(d.claimId) &&
      byId.has(d.accountId)
    )
    .map((d) => {
      const account = byId.get(d.accountId)!;
      return {
        ...d,
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        lenderOrgName:
          db.lenderOrgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
        daysLeft: daysLeft(d.rejection.at),
        held: isHeld(d),
        rowKey: d.id,
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
        },
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        lenderOrgName:
          db.lenderOrgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
        daysLeft: daysLeft(f.review.at),
        held: false,
        rowKey: f.id,
        replaced: { fileId: f.id, fileName: f.originalName, at: f.supersededAt },
      },
    ];
  });

  return [...current, ...replaced].sort((a, b) =>
    b.rejection.at.localeCompare(a.rejection.at)
  );
}
