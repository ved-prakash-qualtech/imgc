import "server-only";

import { readDb } from "@/server/mock/db";
import { getPasValues, updatePasValue } from "@/server/mock/pas";
import { recordEvent } from "@/services/portal/audit.server";
import type { AppSession } from "@/lib/auth/appSession";
import type { PasValue } from "@/server/mock/types";

/**
 * BRD: the lender portal pulls values from PAS and can update values in PAS. Both sides go
 * through `server/mock/pas.ts`, which is the seam a real PAS integration replaces.
 */

async function canReach(session: AppSession, accountId: string): Promise<boolean> {
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
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canReach(session, accountId))) {
    return { ok: false, error: "This account belongs to another lender." };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Give the field a value." };

  const before = (await getPasValues(accountId)).find((v) => v.key === key);
  const updated = await updatePasValue({
    accountId,
    key,
    value: trimmed,
    actor: session.name,
  });
  if (!updated) return { ok: false, error: "That PAS field does not exist." };

  await recordEvent({
    accountId,
    actor: session,
    type: "PAS_VALUE_UPDATED",
    summary: `PAS "${updated.label}" changed from ${before?.value ?? "—"} to ${trimmed}`,
    meta: { field: updated.label, from: before?.value ?? "", to: trimmed },
  });
  return { ok: true };
}
