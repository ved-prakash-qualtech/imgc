"use server";

import type {
  ServerErrorCode,
  ServerErrorParams,
} from "@imgc/config/errorCodes";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@imgc/constants/route";
import { runAction } from "@imgc/data/server/actions/runAction";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  setPushRecipients,
  shiftBucket,
} from "@imgc/data/services/portal/accounts.server";
import type { Bucket } from "@imgc/types/domain";

export type Result = Readonly<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}>;

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
  return runAction(async () => {
    const session = await requireSession();
    const result = await shiftBucket(
      session,
      accountId,
      to,
      extraRecipients.split(/[,;\s]+/).filter(Boolean)
    );
    if (result.ok) refresh(accountId);
    return result;
  });
}

/** BRD: the processor specifies which mail IDs a push goes to. */
export async function setPushRecipientsAction(
  accountId: string,
  recipients: string
): Promise<Result> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await setPushRecipients(
      session,
      accountId,
      recipients.split(/[,;\s]+/).filter(Boolean)
    );
    if (result.ok) refresh(accountId);
    return result;
  });
}
