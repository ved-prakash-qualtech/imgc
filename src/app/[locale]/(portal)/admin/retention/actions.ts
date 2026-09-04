"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { decideReinstate } from "@/services/portal/claims.server";
import { sweepExpiredRejections } from "@/services/portal/retention.server";

export type Result = Readonly<{ ok: boolean; error?: string; purged?: number }>;

export async function runSweepAction(): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  const { purged } = await sweepExpiredRejections();
  revalidatePath(ROUTES.adminRetention);
  return { ok: true, purged };
}

export async function decideReinstateAction(
  accountId: string,
  documentId: string,
  approve: boolean,
  note: string
): Promise<Result> {
  const session = await requireSession();
  const result = await decideReinstate(session, accountId, documentId, approve, note);
  if (result.ok) {
    revalidatePath(ROUTES.adminRetention);
    revalidatePath(ROUTES.account(accountId));
  }
  return result;
}
