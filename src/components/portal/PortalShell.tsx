import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard/DashboardShell";
import { navFor, type NavKey } from "@/constants/nav";
import { requireSession, toSessionUser } from "@/lib/auth/appSession";
import {
  getAssignedOfficer,
  getLenderOrgById,
} from "@/services/portal/users.server";
import { unreadCount } from "@/services/portal/notifications.server";
import { getAdminContextOrNull } from "@/lib/auth/adminContext";

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
  titleAside,
  claimAgeing,
  children,
}: Readonly<{
  activeKey?: NavKey;
  title: string;
  /** The claim amount beside the title in the top bar, e.g. "₹16,90,000". */
  titleAside?: string;
  claimAgeing?: ReactNode;
  children: ReactNode;
}>) {
  const session = await requireSession();
  const ctx = await getAdminContextOrNull();
  const [org, unread, assignedOfficer, adminOrg] = await Promise.all([
    session.role === "LENDER" ? getLenderOrgById(session.lenderOrgId) : null,
    unreadCount(session),
    getAssignedOfficer(session),
    ctx ? getLenderOrgById(ctx.lenderOrgId) : null,
  ]);

  return (
    <DashboardShell
      items={navFor(session.role, session.isAdmin, !!ctx)}
      badges={unread > 0 ? { notifications: unread } : undefined}
      activeKey={activeKey}
      navbarTitle={title}
      navbarTitleAside={titleAside}
      claimAgeing={claimAgeing}
      workspace={session.role === "IMGC" ? "IMGC" : (org?.name ?? "Lender")}
      adminContextName={adminOrg?.name}
      user={toSessionUser(session)}
      unreadCount={unread}
      assignedOfficer={assignedOfficer}
      isAdmin={session.role === "IMGC" && session.isAdmin}
    >
      <main className="flex-1 px-6 py-4">{children}</main>
    </DashboardShell>
  );
}
