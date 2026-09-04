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
  subject: string;
  body: string;
  event: string;
  accountId?: string;
  unreadFor?: Role[];
}): Promise<void> {
  const recipients = Array.from(new Set(input.to.map((t) => t.trim()).filter(Boolean)));
  if (recipients.length === 0) return;

  await writeDb((db) => {
    db.notifications.unshift({
      id: newId("ntf"),
      to: recipients,
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
