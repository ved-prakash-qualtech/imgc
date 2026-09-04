import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import type { AppSession } from "@/lib/auth/appSession";
import type { AuditEvent, AuditType } from "@/server/mock/types";

export async function recordEvent(input: {
  accountId: string;
  actor: AppSession | { userId: string; name: string; role: "SYSTEM" };
  type: AuditType;
  summary: string;
  meta?: Record<string, string>;
}): Promise<void> {
  await writeDb((db) => {
    db.auditEvents.unshift({
      id: newId("aud"),
      accountId: input.accountId,
      at: nowIso(),
      actorId: input.actor.userId,
      actorName: input.actor.name,
      actorRole: input.actor.role,
      type: input.type,
      summary: input.summary,
      meta: input.meta,
    });
  });
}

export async function listAuditForAccount(accountId: string): Promise<AuditEvent[]> {
  const db = await readDb();
  return db.auditEvents.filter((e) => e.accountId === accountId);
}

export async function listRecentAudit(
  accountIds: string[],
  limit = 12
): Promise<AuditEvent[]> {
  const allowed = new Set(accountIds);
  const db = await readDb();
  return db.auditEvents.filter((e) => allowed.has(e.accountId)).slice(0, limit);
}
