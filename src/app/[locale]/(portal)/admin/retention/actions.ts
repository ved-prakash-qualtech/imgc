"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { runAction } from "@/lib/actions/runAction";
import { requireSession } from "@/lib/auth/appSession";
import { archiveRejectedDocument, decideReinstate } from "@/services/portal/claims.server";
import { sweepExpiredRejections } from "@/services/portal/retention.server";

export type Result = Readonly<{ ok: boolean; error?: string; purged?: number }>;

export async function runSweepAction(): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
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
  documentId: string
): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await archiveRejectedDocument(session, accountId, documentId);
    if (result.ok) {
      revalidatePath(ROUTES.adminRetention);
      revalidatePath(ROUTES.account(accountId));
    }
    return result;
  });
}
