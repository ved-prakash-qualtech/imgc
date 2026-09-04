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
}

/** Rejected documents still inside the retention window, newest rejection first. */
export async function listRejectedDocuments(
  session: AppSession
): Promise<RejectedDocRow[]> {
  const db = await readDb();
  const accounts = db.accounts.filter(
    (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
  );
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return db.claimDocuments
    .filter((d): d is ClaimDocument & { rejection: Rejection } =>
      Boolean(d.rejection) && d.status === "REJECTED" && byId.has(d.accountId)
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
      };
    })
    .sort((a, b) => b.rejection.at.localeCompare(a.rejection.at));
}
