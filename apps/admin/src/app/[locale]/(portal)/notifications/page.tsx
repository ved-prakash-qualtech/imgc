import Link from "next/link";
import { MailIcon } from "lucide-react";
import { Section } from "@imgc/features/portal/CommandBand";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { getTranslations } from "next-intl/server";

import { requireSession } from "@imgc/lib/auth/appSession";
import {
  listNotifications,
  markNotificationsRead,
} from "@imgc/data/services/portal/notifications.server";
import { ROUTES } from "@imgc/constants/route";
import type { Role } from "@imgc/types/domain";

export const dynamic = "force-dynamic";

/** Which account tab actually shows what this notification is about — matches the slugs
 *  `AccountWorkspace` reads via `?tab=`. Falls back to Overview for anything doc-unrelated. */
function tabSlugForEvent(event: string): string {
  if (event.startsWith("DOC_") || event === "CLAIM_SUBMITTED")
    return "initial-claims";
  return "overview";
}

/**
 * Where this notification's account actually opens, for the role reading it.
 *
 * Both roles are notified about the same account, but they have different screens for it: the
 * account workspace is IMGC's and its nav key is not granted to a lender, so linking a lender
 * there lands them on a 403 for a case that is plainly their own. The lender's equivalent is
 * their claim workspace, which handles an account with no claim on its own.
 */
function accountHrefFor(role: Role, accountId: string, event: string): string {
  return role === "LENDER"
    ? ROUTES.initiateClaimWorkspace(accountId)
    : `${ROUTES.account(accountId)}?tab=${tabSlugForEvent(event)}`;
}

export default async function NotificationsPage() {
  const session = await requireSession();
  const t = await getTranslations("notifications");

  const notifications = await listNotifications(session);
  // Opening the list is what marks it read — the badge clears for this role only.
  await markNotificationsRead(session);

  return (
    <PortalShell activeKey="notifications" title={t("title")}>
      <div className="space-y-4">
        <Section
          title={t("messageCount", { count: notifications.length })}
          subtitle={t("subtitle")}
        >
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm">
            {notifications.length === 0 ? (
              <p className="px-5 py-12 text-center text-ui-subhead text-neutral-500">
                {t("empty")}
              </p>
            ) : (
              <ol className="divide-y divide-neutral-100">
                {notifications.map((n) => {
                  const body = (
                    <>
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-primary">
                        <MailIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ui-subhead-lg font-semibold text-neutral-950">
                            {n.subject}
                          </span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-ui-tiny font-bold uppercase tracking-wide text-neutral-500">
                            {n.event.replaceAll("_", " ")}
                          </span>
                          <span className="text-ui-body-sm text-neutral-400">
                            {new Date(n.sentAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-ui-subhead leading-relaxed text-neutral-700">
                          {n.body}
                        </p>
                        <p className="mt-1 truncate text-ui-body-sm text-neutral-400">
                          {t("to")} {n.to.join(", ")}
                          {n.cc && n.cc.length > 0 && (
                            <span className="block text-neutral-400">
                              {t("cc")} {n.cc.join(", ")}
                            </span>
                          )}
                        </p>
                      </div>
                    </>
                  );

                  // Every notification here is about one account's claim — link straight into it,
                  // on the tab that actually shows what happened, instead of leaving the reader to
                  // find it themselves in the accounts list.
                  return (
                    <li key={n.id}>
                      {n.accountId ? (
                        <Link
                          href={accountHrefFor(
                            session.role,
                            n.accountId,
                            n.event
                          )}
                          className="flex gap-3 px-5 py-4 transition-colors hover:bg-neutral-50"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-5 py-4">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Section>
      </div>
    </PortalShell>
  );
}
