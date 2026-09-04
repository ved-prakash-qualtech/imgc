import { ROUTES } from "@/constants/route";
import type { Role } from "@/server/mock/types";

/**
 * What the sidebar offers, per role.
 *
 * Plain data on purpose — no icon components. These items are built on the server and handed to
 * a client component, and a React component reference cannot cross that boundary. The sidebar
 * maps `key` to an icon on its own side (see `AppSidebar`).
 */
export type NavKey =
  | "dashboard"
  | "accounts"
  | "buckets"
  | "notifications"
  | "initiate-claim"
  | "track-query-response"
  | "audit-trail"
  | "administration"
  | "admin-users"
  | "admin-retention"
  // Retained from the base template so its demo pages still type-check.
  | "tenants"
  | "menus"
  | "application-management"
  | "roles"
  | "users"
  | "api-clients";

export type NavItem = Readonly<{
  key: NavKey;
  label: string;
  /** A group that only holds children has none: clicking it expands rather than navigating. */
  href?: string;
  children?: readonly NavItem[];
}>;

const DASHBOARD: NavItem = {
  key: "dashboard",
  label: "Dashboard",
  href: ROUTES.dashboard,
};

const ACCOUNTS: NavItem = {
  key: "accounts",
  label: "Accounts",
  href: ROUTES.accounts,
};

const NOTIFICATIONS: NavItem = {
  key: "notifications",
  label: "Notifications",
  href: ROUTES.notifications,
};

const INITIATE_CLAIM: NavItem = {
  key: "initiate-claim",
  label: "Initiate Claim",
  href: ROUTES.initiateClaim,
};

const TRACK_QUERY_RESPONSE: NavItem = {
  key: "track-query-response",
  label: "Track & Query Response",
  href: ROUTES.trackQueryResponse,
};

const AUDIT_TRAIL: NavItem = {
  key: "audit-trail",
  label: "Audit Trail",
  href: ROUTES.auditTrail,
};

/** IMGC only — moving an account between the two processing buckets. */
const BUCKETS: NavItem = {
  key: "buckets",
  label: "Processing Buckets",
  href: ROUTES.buckets,
};

/** IMGC only — who may sign in, and what happens to rejected documents. */
const ADMINISTRATION: NavItem = {
  key: "administration",
  label: "Administration",
  children: [
    { key: "admin-users", label: "Lender Access", href: ROUTES.adminUsers },
    {
      key: "admin-retention",
      label: "Document Retention",
      href: ROUTES.adminRetention,
    },
  ],
};

/**
 * The lender sees their specific set of screens; everything that administers
 * the portal, or that spans lenders, is IMGC's.
 */
export function navFor(role: Role): NavItem[] {
  return role === "IMGC"
    ? [DASHBOARD, ACCOUNTS, BUCKETS, NOTIFICATIONS, ADMINISTRATION]
    : [
        DASHBOARD,
        INITIATE_CLAIM,
        TRACK_QUERY_RESPONSE,
        AUDIT_TRAIL,
        NOTIFICATIONS,
      ];
}
