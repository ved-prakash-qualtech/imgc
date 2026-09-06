import { MailIcon } from "lucide-react";
import { Section } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { redirect } from "next/navigation";
import {
  listNotifications,
  markNotificationsRead,
} from "@/services/portal/notifications.server";
import { ROUTES } from "@/constants/route";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();

  // Lenders no longer have the Notifications item in their nav.
  // Guard direct URL access so they are not left on a nav-less page.
  if (session.role === "LENDER") {
    redirect(ROUTES.dashboard);
  }

  const notifications = await listNotifications(session);
  // Opening the list is what marks it read — the badge clears for this role only.
  await markNotificationsRead(session);

  return (
    <PortalShell activeKey="notifications" title="Notifications">
      <div className="space-y-4">
        <Section
          title={`${notifications.length} message${notifications.length === 1 ? "" : "s"}`}
          subtitle="Prototype: nothing is delivered by email — this is the record of what would be sent."
        >
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm">
            {notifications.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
                Nothing has been sent yet.
              </p>
            ) : (
              <ol className="divide-y divide-neutral-100">
                {notifications.map((n) => (
                  <li key={n.id} className="flex gap-3 px-5 py-4">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-primary">
                      <MailIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-neutral-950">
                          {n.subject}
                        </span>
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {n.event.replaceAll("_", " ")}
                        </span>
                        <span className="text-[11.5px] text-neutral-400">
                          {new Date(n.sentAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                        {n.body}
                      </p>
                      <p className="mt-1 truncate text-[11.5px] text-neutral-400">
                        To: {n.to.join(", ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Section>
      </div>
    </PortalShell>
  );
}
