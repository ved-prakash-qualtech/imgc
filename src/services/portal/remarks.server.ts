import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import { recordEvent } from "@/services/portal/audit.server";
import type { AppSession } from "@/lib/auth/appSession";
import type { Remark } from "@/server/mock/types";

/** BRD: a trail of the remarks and feedback captured from the lender and IMGC alike. */
export async function listRemarks(
  accountId: string,
  documentId?: string
): Promise<Remark[]> {
  const db = await readDb();
  return db.remarks
    .filter((r) => r.accountId === accountId && (documentId ? r.documentId === documentId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addRemark(
  session: AppSession,
  accountId: string,
  body: string,
  documentId?: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Write something first." };

  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Account not found." };
  if (session.role === "LENDER" && account.lenderOrgId !== session.lenderOrgId) {
    return { ok: false, error: "This account belongs to another lender." };
  }
  const docName = documentId
    ? db.claimDocuments.find((d) => d.id === documentId)?.name
    : undefined;

  await writeDb((fresh) => {
    fresh.remarks.unshift({
      id: newId("rmk"),
      accountId,
      documentId,
      authorId: session.userId,
      authorName: session.name,
      authorRole: session.role,
      body: trimmed,
      createdAt: nowIso(),
    });
  });

  await recordEvent({
    accountId,
    actor: session,
    type: "REMARK_ADDED",
    summary: docName
      ? `Remark on "${docName}": ${trimmed}`
      : `Remark: ${trimmed}`,
    meta: docName ? { document: docName } : undefined,
  });
  return { ok: true };
}
