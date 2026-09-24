import "server-only";

import { newId, nowIso } from "@/server/mock/ids";
import { writeDb } from "@/server/mock/db";
import type { Role } from "@/server/mock/types";

/**
 * Stand-in mailer. There is no SMTP in the prototype — every "email" is recorded in the
 * `notifications` collection (shown on the Notifications page) and logged to the server console.
 */
export async function sendMail(input: {
  to: string[];
  /** Kept informed, not asked to act — addresses here are dropped from `to`. */
  cc?: string[];
  subject: string;
  body: string;
  event: string;
  accountId?: string;
  unreadFor?: Role[];
}): Promise<void> {
  const clean = (list: string[] | undefined) =>
    Array.from(new Set((list ?? []).map((t) => t.trim()).filter(Boolean)));
  const recipients = clean(input.to);
  // Nobody is both asked to act and merely copied.
  const copied = clean(input.cc).filter((c) => !recipients.includes(c));
  if (recipients.length === 0 && copied.length === 0) return;

  await writeDb((db) => {
    db.notifications.unshift({
      id: newId("ntf"),
      to: recipients,
      cc: copied.length > 0 ? copied : undefined,
      subject: input.subject,
      body: input.body,
      event: input.event,
      accountId: input.accountId,
      sentAt: nowIso(),
      unreadFor: input.unreadFor,
    });
  });

  // Prototype: the outbox is also surfaced in the server console, which is where a developer
  // reads a lender's one-time sign-in code.
  console.info(
    `[mock-mail] ${input.event} → ${recipients.join(", ")}\n  ${input.subject}\n  ${input.body}`
  );
}
