import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  AuditEvent,
  AuditType,
  DocStatus,
  ReinstateStatus,
  Role,
} from "@/server/mock/types";

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

export async function listAuditForAccount(
  accountId: string
): Promise<AuditEvent[]> {
  const db = await readDb();
  return db.auditEvents.filter((e) => e.accountId === accountId);
}

export async function listRecentAudit(
  accountIds: string[],
  limit = 200
): Promise<AuditEvent[]> {
  const allowed = new Set(accountIds);
  const db = await readDb();
  return db.auditEvents.filter((e) => allowed.has(e.accountId)).slice(0, limit);
}

export interface DocumentTrailItem {
  id: string;
  documentId: string;
  accountId: string;
  accountLoanNo: string;
  borrowerName: string;
  lenderOrgName: string;
  documentName: string;
  category?: string;
  fileName: string;
  version: number;
  uploadedByName: string;
  uploadedAt: string;
  status: DocStatus;
  rejectionReason?: string;
  rejectionDate?: string;
  reinstateStatus?: ReinstateStatus;
  supersededAt?: string;
  supersededReason?: string;
}

export interface AuditRemarkItem {
  id: string;
  accountId: string;
  accountLoanNo: string;
  borrowerName: string;
  documentId?: string;
  documentName?: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export async function listAuditDocumentTrail(
  session: AppSession
): Promise<DocumentTrailItem[]> {
  const db = await readDb();
  const accounts = db.accounts.filter(
    (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
  );
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const docMap = new Map(db.claimDocuments.map((d) => [d.id, d]));
  const orgMap = new Map(db.lenderOrgs.map((o) => [o.id, o.name]));

  return db.documentFiles
    .filter((f) => accountMap.has(f.accountId))
    .map((f) => {
      const account = accountMap.get(f.accountId)!;
      const doc = docMap.get(f.documentId);
      return {
        id: f.id,
        documentId: f.documentId,
        accountId: f.accountId,
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        lenderOrgName: orgMap.get(account.lenderOrgId) ?? "—",
        documentName: doc?.name ?? "Document",
        category: doc?.category,
        fileName: f.originalName,
        version: f.version,
        uploadedByName: f.uploadedByName,
        uploadedAt: f.uploadedAt,
        status: doc?.status ?? "UNDER_REVIEW",
        rejectionReason: doc?.rejection?.reason,
        rejectionDate: doc?.rejection?.at,
        reinstateStatus: doc?.rejection?.reinstate?.status,
        supersededAt: f.supersededAt,
        supersededReason: f.supersededReason,
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listAuditRemarksTrail(
  session: AppSession
): Promise<AuditRemarkItem[]> {
  const db = await readDb();
  const accounts = db.accounts.filter(
    (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
  );
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const docMap = new Map(db.claimDocuments.map((d) => [d.id, d]));

  return db.remarks
    .filter((r) => accountMap.has(r.accountId))
    .map((r) => {
      const account = accountMap.get(r.accountId)!;
      const doc = r.documentId ? docMap.get(r.documentId) : undefined;
      return {
        id: r.id,
        accountId: r.accountId,
        accountLoanNo: account.loanNo,
        borrowerName: account.borrowerName,
        documentId: r.documentId,
        documentName: doc?.name,
        authorName: r.authorName,
        authorRole: r.authorRole,
        body: r.body,
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
