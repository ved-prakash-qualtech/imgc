import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard/DashboardShell";
import { navFor, type NavKey } from "@/constants/nav";
import { requireSession, toSessionUser } from "@/lib/auth/appSession";
import { getAssignedOfficer, getLenderOrgById } from "@/services/portal/users.server";
import { unreadCount } from "@/services/portal/notifications.server";

/**
 * The signed-in frame for every portal page.
 *
 * Resolves the session once and hands `DashboardShell` the nav this role was granted — which is
 * also what stops a lender opening an IMGC-only address by typing it: the shell calls
 * `forbidden()` for an `activeKey` the nav does not contain.
 */
export async function PortalShell({
  activeKey,
  title,
  children,
}: Readonly<{ activeKey?: NavKey; title: string; children: ReactNode }>) {
  const session = await requireSession();
  const [org, unread, assignedOfficer] = await Promise.all([
    session.role === "LENDER" ? getLenderOrgById(session.lenderOrgId) : null,
    unreadCount(session),
    getAssignedOfficer(session),
  ]);

  return (
    <DashboardShell
      items={navFor(session.role)}
      badges={unread > 0 ? { notifications: unread } : undefined}
      activeKey={activeKey}
      navbarTitle={title}
      workspace={session.role === "IMGC" ? "IMGC" : (org?.name ?? "Lender")}
      user={toSessionUser(session)}
      unreadCount={unread}
      assignedOfficer={assignedOfficer}
    >
      <main className="flex-1 px-6 py-4">{children}</main>
    </DashboardShell>
  );
}
