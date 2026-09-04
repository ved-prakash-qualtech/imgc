import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { nowIso } from "@/server/mock/ids";
import type { PasValue } from "@/server/mock/types";

/**
 * Mock PAS (Policy Administration System) boundary. The Lender portal "pulls values from PAS" and
 * "updates values in PAS" — kept as its own module so that seam is explicit and a real build can
 * swap it for the PAS API without touching callers.
 */

export async function getPasValues(accountId: string): Promise<PasValue[]> {
  const db = await readDb();
  return db.pasValues
    .filter((v) => v.accountId === accountId)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function updatePasValue(input: {
  accountId: string;
  key: string;
  value: string;
  actor: string;
}): Promise<PasValue | null> {
  return writeDb((db) => {
    const row = db.pasValues.find(
      (v) => v.accountId === input.accountId && v.key === input.key
    );
    if (!row) return null;
    row.value = input.value;
    row.updatedAt = nowIso();
    row.updatedBy = input.actor;
    return { ...row };
  });
}
