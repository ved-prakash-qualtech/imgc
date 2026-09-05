import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { recordEvent } from "@/services/portal/audit.server";
import {
  notifyBucketShift,
  notifyClaimDecision,
} from "@/services/portal/notifications.server";
import { addRemark } from "@/services/portal/remarks.server";
import { syncClaimForAccountDecision } from "@/services/portal/claimFlow.server";
import type { AppSession } from "@/lib/auth/appSession";
import type { Account, Bucket, ClaimStatus, LenderOrg } from "@/server/mock/types";

export interface AccountRow extends Account {
  lenderOrgName: string;
  requiredDocs: number;
  pendingDocs: number;
}

/** The one place lender scoping is applied: a lender sees an account iff the org ids match. */
function inScope(session: AppSession, account: Account): boolean {
  if (session.role === "IMGC") return true;
  return account.lenderOrgId === session.lenderOrgId;
}

function decorate(account: Account, orgs: LenderOrg[], docs: { accountId: string; required: boolean; status: string }[]): AccountRow {
  const own = docs.filter((d) => d.accountId === account.id);
  return {
    ...account,
    lenderOrgName: orgs.find((o) => o.id === account.lenderOrgId)?.name ?? "—",
    requiredDocs: own.filter((d) => d.required).length,
    pendingDocs: own.filter((d) => d.required && d.status !== "UNDER_REVIEW" && d.status !== "APPROVED").length,
  };
}

export async function listAccounts(session: AppSession): Promise<AccountRow[]> {
  const db = await readDb();
  return db.accounts
    .filter((a) => inScope(session, a))
    .map((a) => decorate(a, db.lenderOrgs, db.claimDocuments))
    .sort((a, b) => a.loanNo.localeCompare(b.loanNo));
}

export async function getAccount(
  session: AppSession,
  accountId: string
): Promise<AccountRow | null> {
  const db = await readDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account || !inScope(session, account)) return null;
  return decorate(account, db.lenderOrgs, db.claimDocuments);
}

export async function listAccessibleAccountIds(session: AppSession): Promise<string[]> {
  const db = await readDb();
  return db.accounts.filter((a) => inScope(session, a)).map((a) => a.id);
}

export async function getLenderOrg(orgId: string): Promise<LenderOrg | null> {
  const db = await readDb();
  return db.lenderOrgs.find((o) => o.id === orgId) ?? null;
}

/* ── IMGC mutations ────────────────────────────────────────────────── */

export async function shiftBucket(
  session: AppSession,
  accountId: string,
  to: Bucket,
  extraRecipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const outcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const, error: "Account not found." };
    const from = account.bucket;
    if (from === to) return { ok: false as const, error: `Already in the ${to} bucket.` };
    account.bucket = to;
    account.stage = to === "IMGC" ? "Under IMGC review" : "Document collection";
    account.pushRecipients = Array.from(
      new Set([...account.pushRecipients, ...extraRecipients.map((e) => e.trim()).filter(Boolean)])
    );
    return { ok: true as const, from, account: { ...account } };
  });

  if (!outcome.ok) return outcome;

  await recordEvent({
    accountId,
    actor: session,
    type: "BUCKET_SHIFTED",
    summary: `Account moved from the ${outcome.from} bucket to the ${to} bucket`,
    meta: { from: outcome.from, to },
  });
  await notifyBucketShift(outcome.account, outcome.from, to, session);
  return { ok: true };
}

export async function setClaimStatus(
  session: AppSession,
  accountId: string,
  status: Extract<ClaimStatus, "APPROVED" | "QUERIED">,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const trimmedNote = note.trim();

  const outcome = await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false as const, error: "Account not found." };
    const from = account.claimStatus;
    account.claimStatus = status;
    // The processing itself happened in PAS; the portal records the outcome and the stage the
    // lender now sees against the account.
    account.stage = status === "APPROVED" ? "Claim approved" : "Query raised with the lender";
    return { ok: true as const, from, account: { ...account } };
  });
  if (!outcome.ok) return outcome;

  // The Overview tab only ever wrote this account's own claimStatus; the Claim entity — what
  // Track Claim, the lender's workspace and this claim's status-history graph read — was left
  // behind. Sync it here so an approval or query made from this screen shows up everywhere else.
  await syncClaimForAccountDecision(session, accountId, status, trimmedNote);

  await recordEvent({
    accountId,
    actor: session,
    type: "CLAIM_STATUS_CHANGED",
    summary: `Claim marked ${status}${trimmedNote ? ` — ${trimmedNote}` : ""}`,
    meta: { status, from: outcome.from },
  });

  // The note goes on the remarks thread as well as into the audit meta. The audit trail is a
  // record for whoever investigates later; the remark is what the lender actually reads, and a
  // query whose reason is only in an audit row reads to them as a refusal with no explanation.
  if (trimmedNote) {
    await addRemark(
      session,
      accountId,
      `Claim ${status.toLowerCase()}: ${trimmedNote}`
    );
  }

  await notifyClaimDecision(outcome.account, status, trimmedNote, session);
  return { ok: true };
}

export async function setPushRecipients(
  session: AppSession,
  accountId: string,
  recipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  await writeDb((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (account) {
      account.pushRecipients = recipients.map((r) => r.trim()).filter(Boolean);
    }
  });
  return { ok: true };
}
