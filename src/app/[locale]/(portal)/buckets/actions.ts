"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { setPushRecipients, shiftBucket } from "@/services/portal/accounts.server";
import type { Bucket } from "@/server/mock/types";

export type Result = Readonly<{ ok: boolean; error?: string }>;

function refresh(accountId: string): void {
  revalidatePath(ROUTES.buckets);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.notifications);
  revalidatePath(ROUTES.account(accountId));
}

/** BRD: IMGC can pull an account into their bucket at any time — and hand it back. */
export async function shiftBucketAction(
  accountId: string,
  to: Bucket,
  extraRecipients: string
): Promise<Result> {
  const session = await requireSession();
  const result = await shiftBucket(
    session,
    accountId,
    to,
    extraRecipients.split(/[,;\s]+/).filter(Boolean)
  );
  if (result.ok) refresh(accountId);
  return result;
}

/** BRD: the processor specifies which mail IDs a push goes to. */
export async function setPushRecipientsAction(
  accountId: string,
  recipients: string
): Promise<Result> {
  const session = await requireSession();
  const result = await setPushRecipients(
    session,
    accountId,
    recipients.split(/[,;\s]+/).filter(Boolean)
  );
  if (result.ok) refresh(accountId);
  return result;
}
