"use server";

import {
  fail,
  type ServerErrorCode,
  type ServerErrorParams,
} from "@imgc/config/errorCodes";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@imgc/constants/route";
import { runAction } from "@imgc/data/server/actions/runAction";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  archiveRejectedDocument,
  decideReinstate,
} from "@imgc/data/services/portal/claims.server";
import { sweepExpiredRejections } from "@imgc/data/services/portal/retention.server";

export type Result = Readonly<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
  purged?: number;
}>;

export async function runSweepAction(): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    if (session.role !== "IMGC") return fail("IMGC_ONLY");
    const { purged } = await sweepExpiredRejections();
    revalidatePath(ROUTES.adminRetention);
    return { ok: true, purged };
  });
}

export async function decideReinstateAction(
  accountId: string,
  documentId: string,
  approve: boolean,
  note: string
): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await decideReinstate(
      session,
      accountId,
      documentId,
      approve,
      note
    );
    if (result.ok) {
      revalidatePath(ROUTES.adminRetention);
      revalidatePath(ROUTES.account(accountId));
      // The lender is told by mail; the badge has to follow.
      revalidatePath(ROUTES.notifications);
    }
    return result;
  });
}

export async function archiveDocumentAction(
  accountId: string,
  documentId: string,
  /** Set for a rejected file the lender has since replaced — see `archiveRejectedDocument`. */
  fileId?: string
): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await archiveRejectedDocument(
      session,
      accountId,
      documentId,
      fileId
    );
    if (result.ok) {
      revalidatePath(ROUTES.adminRetention);
      revalidatePath(ROUTES.account(accountId));
    }
    return result;
  });
}
