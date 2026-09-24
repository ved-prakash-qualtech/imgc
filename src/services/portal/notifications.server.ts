import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { sendMail } from "@/server/mock/mailer";
import type { AppSession } from "@/lib/auth/appSession";
import type { Account, Bucket, Notification } from "@/server/mock/types";

/**
 * Who has to act, and who is only kept informed.
 *
 * The side named in `side` is the one the notification asks something of, so it is addressed
 * directly; the other side and the account's pinned addresses are copied. `"BOTH"` is for purely
 * informational events, where everyone is addressed as before.
 */
async function audienceFor(
  account: Account,
  side: "LENDER" | "IMGC" | "BOTH"
): Promise<{ to: string[]; cc: string[] }> {
  const db = await readDb();
  const lender =
    db.lenderOrgs.find((o) => o.id === account.lenderOrgId)?.contactEmails ??
    [];
  const imgc = db.users.filter((u) => u.role === "IMGC").map((u) => u.email);
  const pinned = account.pushRecipients;
  if (side === "BOTH") return { to: [...lender, ...imgc, ...pinned], cc: [] };
  const to = side === "LENDER" ? lender : imgc;
  const other = side === "LENDER" ? imgc : lender;
  return { to, cc: [...other, ...pinned] };
}

export async function notifyBucketShift(
  account: Account,
  from: Bucket,
  to: Bucket,
  actor: AppSession
): Promise<void> {
  await sendMail({
    ...(await audienceFor(account, "BOTH")),
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
    ...(await audienceFor(account, "IMGC")),
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
  // eslint-disable-next-line security/detect-object-injection -- `decision` is a closed union
  const copy = DECISION_COPY[decision];
  await sendMail({
    ...(await audienceFor(account, "LENDER")),
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
    ...(await audienceFor(account, "IMGC")),
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
    ...(await audienceFor(account, "LENDER")),
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
export async function markNotificationsRead(
  session: AppSession
): Promise<void> {
  await writeDb((db) => {
    for (const n of db.notifications) {
      if (n.unreadFor?.includes(session.role)) {
        n.unreadFor = n.unreadFor.filter((r) => r !== session.role);
      }
    }
  });
}

/** IMGC sees the whole outbox; a lender sees only what was addressed to their org. */
export async function listNotifications(
  session: AppSession
): Promise<Notification[]> {
  const db = await readDb();
  if (session.role === "IMGC") return db.notifications;

  const orgAccounts = new Set(
    db.accounts
      .filter((a) => a.lenderOrgId === session.lenderOrgId)
      .map((a) => a.id)
  );
  const domain = session.lenderDomain ?? "";
  return db.notifications.filter(
    (n) =>
      (n.accountId && orgAccounts.has(n.accountId)) ||
      [...n.to, ...(n.cc ?? [])].some((t) => t.endsWith(`@${domain}`))
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
    ...(await audienceFor(account, "LENDER")),
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

/**
 * A reinstatement decision is IMGC's answer to something the lender asked for, and the retention
 * clock only stops while it is pending — so the lender has to hear the outcome either way. An
 * approval puts the document back in play; a denial leaves it on its 90-day countdown.
 */
export async function notifyReinstateDecision(
  account: Account,
  documentName: string,
  approved: boolean,
  note: string,
  actor: AppSession
): Promise<void> {
  const verdict = approved ? "approved" : "denied";
  await sendMail({
    ...(await audienceFor(account, "LENDER")),
    subject: `[${account.loanNo}] reinstatement ${verdict} for ${documentName}`,
    body:
      `${actor.name} ${verdict} the reinstatement request for ${documentName} on ` +
      `${account.loanNo} (${account.borrowerName}).` +
      (note ? ` Remarks: ${note}` : "") +
      (approved
        ? " The document is back under review — no re-upload is needed."
        : " The document stays rejected and will be purged at the end of its retention period."),
    event: "REINSTATE_DECIDED",
    accountId: account.id,
    // The outcome is the lender's cue to act, so it lands unread on their side.
    unreadFor: ["LENDER"],
  });
}

/** The lender is asking for a rejected document back — IMGC is the side that now has to decide. */
export async function notifyReinstateRequested(
  account: Account,
  documentName: string,
  note: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    ...(await audienceFor(account, "IMGC")),
    subject: `[${account.loanNo}] reinstatement requested for ${documentName}`,
    body:
      `${actor.name} requested reinstatement of the rejected document ${documentName} on ` +
      `${account.loanNo} (${account.borrowerName}).` +
      (note ? ` Reason: ${note}` : "") +
      " Retention is on hold until IMGC approves or denies the request.",
    event: "REINSTATE_REQUESTED",
    accountId: account.id,
    unreadFor: ["IMGC"],
  });
}

/** The lender cannot supply a document — IMGC is the side that now has to decide. */
export async function notifyWaiverRequested(
  account: Account,
  documentName: string,
  reason: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    ...(await audienceFor(account, "IMGC")),
    subject: `[${account.loanNo}] waiver requested for ${documentName}`,
    body:
      `${actor.name} asked for ${documentName} on ${account.loanNo} ` +
      `(${account.borrowerName}) to be waived. Reason: ${reason} ` +
      "The claim can be submitted meanwhile, but it cannot go for review until IMGC decides.",
    event: "DOC_WAIVER_REQUESTED",
    accountId: account.id,
    unreadFor: ["IMGC"],
  });
}

/** IMGC's answer decides whether the lender still has to produce the document. */
export async function notifyWaiverDecided(
  account: Account,
  documentName: string,
  approved: boolean,
  remarks: string,
  actor: AppSession
): Promise<void> {
  await sendMail({
    ...(await audienceFor(account, "LENDER")),
    subject: `[${account.loanNo}] waiver ${approved ? "approved" : "declined"} for ${documentName}`,
    body:
      `${actor.name} ${approved ? "approved" : "declined"} the waiver for ${documentName} on ` +
      `${account.loanNo} (${account.borrowerName}).` +
      (remarks ? ` Remarks: ${remarks}` : "") +
      (approved
        ? " The claim proceeds without this document."
        : " The document is still required — please upload it."),
    event: "DOC_WAIVER_DECIDED",
    accountId: account.id,
    unreadFor: ["LENDER"],
  });
}
