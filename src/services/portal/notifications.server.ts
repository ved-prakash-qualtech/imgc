import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { sendMail } from "@/server/mock/mailer";
import type { AppSession } from "@/lib/auth/appSession";
import type { Account, Bucket, Notification } from "@/server/mock/types";

/**
 * Who hears about an account event: the lender org's stakeholder mailboxes, every IMGC staff
 * mailbox, and whatever extra addresses the processor pinned to the account.
 */
async function recipientsFor(account: Account): Promise<string[]> {
  const db = await readDb();
  const org = db.lenderOrgs.find((o) => o.id === account.lenderOrgId);
  const imgc = db.users.filter((u) => u.role === "IMGC").map((u) => u.email);
  return [...(org?.contactEmails ?? []), ...imgc, ...account.pushRecipients];
}

export async function notifyBucketShift(
  account: Account,
  from: Bucket,
  to: Bucket,
  actor: AppSession
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] moved to the ${to} bucket`,
    body:
      `Account ${account.loanNo} (${account.borrowerName}) moved from the ${from} bucket to ` +
      `the ${to} bucket by ${actor.name}. ` +
      (to === "LENDER"
        ? "The lender team can now upload and submit documents."
        : "IMGC has taken the account for processing."),
    event: "BUCKET_SHIFTED",
    accountId: account.id,
  });
}

export async function notifyClaimSubmitted(
  account: Account,
  actor: AppSession
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] initial claim submitted`,
    body: `${actor.name} submitted all required documents for ${account.loanNo} (${account.borrowerName}). The account is ready for IMGC review.`,
    event: "CLAIM_SUBMITTED",
    accountId: account.id,
  });
}

const DECISION_COPY = {
  APPROVED: {
    subject: (d: string, c: string) => `${d} has been approved for ${c}`,
    body: (d: string, c: string) => `${d} has been approved for ${c}.`,
  },
  REJECTED: {
    subject: (d: string, c: string) => `${d} has been rejected for ${c}`,
    body: (d: string, c: string) =>
      `${d} has been rejected for ${c}. Please review the remarks.`,
  },
  REUPLOAD_REQUESTED: {
    subject: (d: string, c: string) => `Re-upload required for ${d} on ${c}`,
    body: (d: string, c: string) => `Re-upload required for ${d} on ${c}.`,
  },
} as const;

export async function notifyDocumentDecision(
  account: Account,
  documentName: string,
  decision: "APPROVED" | "REJECTED" | "REUPLOAD_REQUESTED",
  reason: string,
  actor: AppSession
): Promise<void> {
  const copy = DECISION_COPY[decision];
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] ${copy.subject(documentName, account.loanNo)}`,
    body:
      `${copy.body(documentName, account.loanNo)} Reviewed by ${actor.name}.` +
      (reason ? ` Remarks: ${reason}` : ""),
    event: `DOC_${decision}`,
    accountId: account.id,
    // The decision is the lender's cue to act, so it lands unread on their side.
    unreadFor: ["LENDER"],
  });
}

/** The lender has uploaded — IMGC is the side that now has something to do. */
export async function notifyDocumentUploaded(
  account: Account,
  documentName: string,
  version: number,
  actor: AppSession,
  lenderName: string
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] ${documentName} uploaded by ${lenderName}`,
    body:
      `${documentName} uploaded by ${lenderName} for ${account.loanNo} ` +
      `(version ${version}, by ${actor.name}). Ready for IMGC review.`,
    event: "DOC_UPLOADED",
    accountId: account.id,
    unreadFor: ["IMGC"],
  });
}

/** A new requirement is the lender's cue to upload. */
export async function notifyRequirementAdded(
  account: Account,
  documentName: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] new document requirement: ${documentName}`,
    body:
      `New document requirement added: ${documentName} for ${account.loanNo}. ` +
      `Added by ${actor.name}.`,
    event: "DOC_REQUIREMENT_ADDED",
    accountId: account.id,
    unreadFor: ["LENDER"],
  });
}

/** How many notifications this role has not yet opened. */
export async function unreadCount(session: AppSession): Promise<number> {
  const visible = await listNotifications(session);
  return visible.filter((n) => n.unreadFor?.includes(session.role)).length;
}

/** Called when the notifications page is opened — clears the badge for that role only. */
export async function markNotificationsRead(session: AppSession): Promise<void> {
  await writeDb((db) => {
    for (const n of db.notifications) {
      if (n.unreadFor?.includes(session.role)) {
        n.unreadFor = n.unreadFor.filter((r) => r !== session.role);
      }
    }
  });
}

/** IMGC sees the whole outbox; a lender sees only what was addressed to their org. */
export async function listNotifications(session: AppSession): Promise<Notification[]> {
  const db = await readDb();
  if (session.role === "IMGC") return db.notifications;

  const orgAccounts = new Set(
    db.accounts.filter((a) => a.lenderOrgId === session.lenderOrgId).map((a) => a.id)
  );
  const domain = session.lenderDomain ?? "";
  return db.notifications.filter(
    (n) =>
      (n.accountId && orgAccounts.has(n.accountId)) ||
      n.to.some((t) => t.endsWith(`@${domain}`))
  );
}

/**
 * BRD: processing happens in PAS and only the outcome is recorded here — so this notification is
 * the only thing that tells the lender a decision was reached. A query raised in silence is a
 * query nobody answers.
 */
export async function notifyClaimDecision(
  account: Account,
  status: "APPROVED" | "QUERIED" | "REJECTED",
  note: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] claim ${status.toLowerCase()}`,
    body:
      `${actor.name} recorded the PAS outcome for ${account.loanNo} ` +
      `(${account.borrowerName}) as ${status}.` +
      (note ? ` Note: ${note}` : "") +
      (status === "QUERIED"
        ? " The lender team should review the query and respond on the account."
        : ""),
    event: "CLAIM_STATUS_CHANGED",
    accountId: account.id,
  });
}
