import "server-only";
import { msg } from "@imgc/i18n/recordMessages";

import { readDb, writeDb } from "@imgc/data/server/mock/db";
import { sendMail } from "@imgc/data/server/mock/mailer";
import type { AppSession } from "@imgc/lib/auth/appSession";
import type { Account, Bucket, Notification } from "@imgc/types/domain";

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
    subject: msg("mail.bucketMovedSubject", { loanNo: account.loanNo, to }),
    body:
      msg("mail.bucketMovedBody", {
        loanNo: account.loanNo,
        borrower: account.borrowerName,
        from,
        to,
        actor: actor.name,
      }) + msg(to === "LENDER" ? "mail.bucketToLender" : "mail.bucketToImgc"),
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
    subject: msg("mail.initialSubmittedSubject", { loanNo: account.loanNo }),
    body: msg("mail.initialSubmittedBody", {
      actor: actor.name,
      loanNo: account.loanNo,
      borrower: account.borrowerName,
    }),
    event: "CLAIM_SUBMITTED",
    accountId: account.id,
  });
}

const DECISION_COPY = {
  APPROVED: {
    subject: "mail.docApprovedSubject",
    body: "mail.docApprovedBody",
  },
  REJECTED: {
    subject: "mail.docRejectedSubject",
    body: "mail.docRejectedBody",
  },
  REUPLOAD_REQUESTED: {
    subject: "mail.docReuploadSubject",
    body: "mail.docReuploadBody",
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
    subject: msg("mail.subjectPrefix", {
      loanNo: account.loanNo,
      text: msg(copy.subject, { doc: documentName, loanNo: account.loanNo }),
    }),
    body:
      msg(copy.body, { doc: documentName, loanNo: account.loanNo }) +
      msg("mail.reviewedBy", { actor: actor.name }) +
      (reason ? msg("mail.remarksSuffix", { remarks: reason }) : ""),
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
    subject: msg("mail.uploadedSubject", {
      loanNo: account.loanNo,
      doc: documentName,
      lender: lenderName,
    }),
    body: msg("mail.uploadedBody", {
      doc: documentName,
      lender: lenderName,
      loanNo: account.loanNo,
      version,
      actor: actor.name,
    }),
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
    subject: msg("mail.requirementAddedSubject", {
      loanNo: account.loanNo,
      doc: documentName,
    }),
    body: msg("mail.requirementAddedBody", {
      doc: documentName,
      loanNo: account.loanNo,
      actor: actor.name,
    }),
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
    subject: msg("mail.claimDecisionSubject", {
      loanNo: account.loanNo,
      status: status.toLowerCase(),
    }),
    body:
      msg("mail.claimDecisionBody", {
        actor: actor.name,
        loanNo: account.loanNo,
        borrower: account.borrowerName,
        status,
      }) +
      (note ? msg("mail.noteSuffix", { note }) : "") +
      (status === "QUERIED" ? msg("mail.queriedAdvice") : ""),
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
    subject: msg("mail.reinstateDecidedSubject", {
      loanNo: account.loanNo,
      verdict,
      doc: documentName,
    }),
    body:
      msg("mail.reinstateDecidedBody", {
        actor: actor.name,
        verdict,
        doc: documentName,
        loanNo: account.loanNo,
        borrower: account.borrowerName,
      }) +
      (note ? msg("mail.remarksSuffix", { remarks: note }) : "") +
      msg(
        approved ? "mail.reinstateApprovedAdvice" : "mail.reinstateDeniedAdvice"
      ),
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
    subject: msg("mail.reinstateRequestedSubject", {
      loanNo: account.loanNo,
      doc: documentName,
    }),
    body:
      msg("mail.reinstateRequestedBody", {
        actor: actor.name,
        doc: documentName,
        loanNo: account.loanNo,
        borrower: account.borrowerName,
      }) +
      (note ? msg("mail.reasonSuffix", { note }) : "") +
      msg("mail.reinstateHold"),
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
    subject: msg("mail.waiverRequestedSubject", {
      loanNo: account.loanNo,
      doc: documentName,
    }),
    body: msg("mail.waiverRequestedBody", {
      actor: actor.name,
      doc: documentName,
      loanNo: account.loanNo,
      borrower: account.borrowerName,
      reason,
    }),
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
    subject: msg("mail.waiverDecidedSubject", {
      loanNo: account.loanNo,
      verdict: approved ? "approved" : "declined",
      doc: documentName,
    }),
    body:
      msg("mail.waiverDecidedBody", {
        actor: actor.name,
        verdict: approved ? "approved" : "declined",
        doc: documentName,
        loanNo: account.loanNo,
        borrower: account.borrowerName,
      }) +
      (remarks ? msg("mail.remarksSuffix", { remarks }) : "") +
      msg(approved ? "mail.waiverApprovedAdvice" : "mail.waiverDeclinedAdvice"),
    event: "DOC_WAIVER_DECIDED",
    accountId: account.id,
    unreadFor: ["LENDER"],
  });
}
