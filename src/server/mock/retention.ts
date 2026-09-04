import "server-only";

import { promises as fs } from "node:fs";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import type { ClaimDocument } from "@/server/mock/types";

/**
 * Rejected documents are kept for 90 days from rejection, then purged — unless a reinstatement
 * has been requested or approved, which holds them. The sweep runs lazily (dashboard / retention
 * page load) and from the manual "Run sweep" action.
 */
export const RETENTION_DAYS = 90;

export function retentionDeadline(rejectedAt: string): Date {
  const d = new Date(rejectedAt);
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d;
}

export function daysLeft(rejectedAt: string): number {
  const ms = retentionDeadline(rejectedAt).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Held from purge while a reinstatement is in play. */
export function isHeld(doc: ClaimDocument): boolean {
  const status = doc.rejection?.reinstate?.status;
  return status === "REQUESTED" || status === "APPROVED";
}

export async function sweepExpiredRejections(): Promise<{ purged: number }> {
  const db = await readDb();
  const expired = db.claimDocuments.filter(
    (d) =>
      d.status === "REJECTED" &&
      d.rejection &&
      !isHeld(d) &&
      daysLeft(d.rejection.at) <= 0
  );
  if (expired.length === 0) return { purged: 0 };

  // Remove the stored files first; missing files are fine.
  for (const doc of expired) {
    const files = db.documentFiles.filter((f) => f.documentId === doc.id);
    for (const f of files) {
      await fs.rm(f.storedPath, { force: true }).catch(() => undefined);
    }
  }

  return writeDb((fresh) => {
    let purged = 0;
    for (const doc of expired) {
      const row = fresh.claimDocuments.find((d) => d.id === doc.id);
      if (!row || row.status !== "REJECTED" || isHeld(row)) continue;
      if (!row.rejection || daysLeft(row.rejection.at) > 0) continue;

      fresh.documentFiles = fresh.documentFiles.filter(
        (f) => f.documentId !== row.id
      );
      row.status = "PENDING";
      row.currentFileId = undefined;
      row.rejection = undefined;
      purged += 1;
      fresh.auditEvents.unshift({
        id: newId("aud"),
        accountId: row.accountId,
        at: nowIso(),
        actorId: "system",
        actorName: "Retention sweep",
        actorRole: "SYSTEM",
        type: "RETENTION_PURGED",
        summary: `Rejected document "${row.name}" purged after ${RETENTION_DAYS}-day retention`,
      });
    }
    return { purged };
  });
}
