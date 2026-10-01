import "server-only";
import { msg } from "@imgc/i18n/recordMessages";

import {
  fail,
  type ServerErrorCode,
  type ServerErrorParams,
} from "@imgc/config/errorCodes";

import { readDb } from "@imgc/data/server/mock/db";
import { getPasValues, updatePasValue } from "@imgc/data/server/mock/pas";
import { recordEvent } from "@imgc/data/services/portal/audit.server";
import type { AppSession } from "@imgc/lib/auth/appSession";
import type { PasValue } from "@imgc/types/domain";

/**
 * BRD: the lender portal pulls values from PAS and can update values in PAS. Both sides go
 * through `server/mock/pas.ts`, which is the seam a real PAS integration replaces.
 */

async function canReach(
  session: AppSession,
  accountId: string
): Promise<boolean> {
  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return false;
  return session.role === "IMGC" || account.lenderOrgId === session.lenderOrgId;
}

export async function pullFromPas(
  session: AppSession,
  accountId: string
): Promise<PasValue[]> {
  if (!(await canReach(session, accountId))) return [];
  return getPasValues(accountId);
}

export async function pushToPas(
  session: AppSession,
  accountId: string,
  key: string,
  value: string
): Promise<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}> {
  if (!(await canReach(session, accountId))) {
    return fail("ACCOUNT_OTHER_LENDER");
  }
  const trimmed = value.trim();
  if (!trimmed) return fail("FIELD_VALUE_REQUIRED");

  const before = (await getPasValues(accountId)).find((v) => v.key === key);
  const updated = await updatePasValue({
    accountId,
    key,
    value: trimmed,
    actor: session.name,
  });
  if (!updated) return fail("PAS_FIELD_UNKNOWN");

  await recordEvent({
    accountId,
    actor: session,
    type: "PAS_VALUE_UPDATED",
    summary: msg("audit.pasChanged", {
      label: updated.label,
      before: before?.value ?? "—",
      after: trimmed,
    }),
    meta: { field: updated.label, from: before?.value ?? "", to: trimmed },
  });
  return { ok: true };
}
