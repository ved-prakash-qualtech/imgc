import "server-only";

import { readDb } from "@/server/mock/db";
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

export async function notifyDocumentDecision(
  account: Account,
  documentName: string,
  decision: "ACCEPTED" | "REJECTED",
  reason: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    to: await recipientsFor(account),
    subject: `[${account.loanNo}] ${documentName} ${decision.toLowerCase()}`,
    body:
      `${actor.name} marked "${documentName}" as ${decision} on ${account.loanNo}.` +
      (reason ? ` Reason: ${reason}` : ""),
    event: `DOC_${decision}`,
    accountId: account.id,
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
