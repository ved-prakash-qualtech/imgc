import { AppFooter } from "@/components/layout/dashboard/AppFooter";
import { AppNavbar } from "@/components/layout/dashboard/AppNavbar";
import { AppSidebar } from "@/components/layout/dashboard/AppSidebar";
import type { NavItem, NavKey } from "@/constants/nav";
import type { SessionUser } from "@/lib/auth/session";
import { forbidden } from "next/navigation";

export type DashboardShellProps = Readonly<{
  children: React.ReactNode;
  /** What the signed-in user may reach. Built on the server from the host's scope. */
  items: NavItem[];
  activeKey?: NavKey;
  /** Count bubbles keyed by nav key, e.g. unread notifications. */
  badges?: Partial<Record<NavKey, number>>;
  navbarTitle?: string;
  /** Tenant short code, or the admin scope — shown at the left of the navbar. */
  workspace?: string;
  user?: SessionUser | null;
  sidebarDefaultCollapsed?: boolean;
}>;

/** Is this key anywhere in the tree the caller was granted, at either level? */
function granted(items: NavItem[], key: NavKey): boolean {
  return items.some(
    (item) =>
      item.key === key ||
      (item.children?.some((child) => child.key === key) ?? false)
  );
}

/**
 * Full-page shell: sidebar rail on the left + top navbar + gradient content area + the
 * footer that closes every screen.
 * Use this as the outer wrapper for all post-login dashboard pages.
 *
 * <h2>It also refuses a page the caller was not granted</h2>
 * The sidebar was the only thing honouring a menu grant: it hid what you could not reach, and
 * typing the address opened it anyway. Hiding a link is not access control — it is the difference
 * between a screen a person cannot find and one they cannot open.
 *
 * <p>Enforced here rather than in each page because every page already passes both halves of the
 * question: {@code items} is what this caller may reach, {@code activeKey} is what they asked for.
 * A page that forgets to check cannot exist, because a page that does not render through this
 * shell has no sidebar either.
 *
 * <p>Pages that pass no {@code activeKey} are not claiming to be a menu, so nothing is checked.
 * The backend still guards its own endpoints: this stops the screen, not the data.
 */
export function DashboardShell({
  children,
  items,
  activeKey,
  badges,
  navbarTitle,
  workspace,
  user,
  sidebarDefaultCollapsed = false,
}: DashboardShellProps) {
  if (activeKey && !granted(items, activeKey)) {
    forbidden();
  }

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#FFFFFF_-6.3%,#FFF3E9_42.72%,#FAD9BC_96.7%)]">
      <AppSidebar
        items={items}
        activeKey={activeKey}
        badges={badges}
        defaultCollapsed={sidebarDefaultCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppNavbar title={navbarTitle} workspace={workspace} user={user} />
        {/* flex-1 so a short page pushes the footer to the bottom rather than leaving
            it floating directly under the content. */}
        <div className="flex flex-1 flex-col">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}
