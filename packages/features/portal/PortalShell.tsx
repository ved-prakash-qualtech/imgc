import type { ReactNode } from "react";

import { DashboardShell } from "@imgc/features/layout/dashboard/DashboardShell";
import { navFor, type NavKey } from "@imgc/constants/nav";
import { requireSession, toSessionUser } from "@imgc/lib/auth/appSession";
import {
  getAssignedOfficer,
  getLenderOrgById,
  getUserById,
} from "@imgc/data/services/portal/users.server";
import { getGlobalBranding } from "@imgc/data/services/portal/brandingConfig.server";
import { unreadCount } from "@imgc/data/services/portal/notifications.server";
import { getAdminContextOrNull } from "@imgc/lib/auth/adminContext";
import { themeStyle } from "@imgc/data/server/tenantTheme";
import { cn } from "@imgc/lib/utils/twMergeUtils";

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
  fullHeight,
  noFooter,
  contentClassName,
}: Readonly<{
  activeKey?: NavKey;
  title: string;
  /** The claim amount beside the title in the top bar, e.g. "₹16,90,000". */
  titleAside?: string;
  claimAgeing?: ReactNode;
  children: ReactNode;
  fullHeight?: boolean;
  noFooter?: boolean;
  contentClassName?: string;
}>) {
  const session = await requireSession();
  const ctx = await getAdminContextOrNull();
  const [org, unread, assignedOfficer, adminOrg, userRecord, globalBranding] =
    await Promise.all([
      session.role === "LENDER" ? getLenderOrgById(session.lenderOrgId) : null,
      unreadCount(session),
      getAssignedOfficer(session),
      ctx ? getLenderOrgById(ctx.lenderOrgId) : null,
      getUserById(session.userId),
      getGlobalBranding(),
    ]);

  const badges = unread > 0 ? { notifications: unread } : undefined;

  const activeOrg = org ?? adminOrg;
  const userPersonalization = userRecord?.personalization;

  // Personalization: Each user configures their own personal appearance studios.
  // Themes are strictly kept separate and never implemented from IMGC to lender.
  const effectiveTheme = userPersonalization?.theme;
  const brandStyle = effectiveTheme
    ? themeStyle(effectiveTheme, userPersonalization?.customColors)
    : undefined;
  const workspaceTitle = activeOrg?.portalTitle
    ? activeOrg.portalTitle.replace(/ Portal$/i, "")
    : session.role === "IMGC"
      ? "IMGC"
      : (org?.name ?? "Lender");

  const isLenderView = session.role === "LENDER" || Boolean(ctx);
  const effectiveLenderLogo = isLenderView
    ? (activeOrg?.logoUrl ??
      (activeOrg?.id === "org_acme" ? "/assets/icons/hdfclogo.png" : undefined))
    : undefined;

  const imgcMasterLogo =
    globalBranding?.imgcLogoUrl || "/assets/icons/logo.png";

  return (
    <DashboardShell
      items={navFor(session.role)}
      badges={badges}
      activeKey={activeKey}
      navbarTitle={title}
      navbarTitleAside={titleAside}
      claimAgeing={claimAgeing}
      workspace={workspaceTitle}
      adminContextName={adminOrg?.name}
      user={toSessionUser(session)}
      unreadCount={unread}
      assignedOfficer={assignedOfficer}
      isAdmin={session.role === "IMGC" && session.isAdmin}
      isImgc={session.role === "IMGC"}
      logoUrl={imgcMasterLogo}
      lenderLogoUrl={effectiveLenderLogo}
      lenderName={activeOrg?.name}
      style={brandStyle}
      fullHeight={fullHeight}
      noFooter={noFooter}
    >
      <main
        className={cn(
          "flex-1",
          fullHeight
            ? "flex min-h-0 flex-col overflow-hidden p-0"
            : "px-6 py-4",
          contentClassName
        )}
      >
        {children}
      </main>
    </DashboardShell>
  );
}
