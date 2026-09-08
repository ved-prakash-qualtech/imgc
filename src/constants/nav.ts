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
  | "dpd"
  | "additional-documents"
  | "notifications"
  | "initiate-claim"
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
  label: "Claims",
  href: ROUTES.accounts,
};

/** All lender-eligible accounts by Days Past Due — a second lens on the same accounts the claim
 *  grid already shows, not restricted to NPA. */
const DPD: NavItem = {
  key: "dpd",
  label: "All Loans",
  href: ROUTES.dpd,
};

/** Initiating a claim and tracking one used to be two tabs; one grid now does both, so there is
 *  only one nav entry for it. */
const CLAIM: NavItem = {
  key: "initiate-claim",
  label: "Claim",
  href: ROUTES.initiateClaim,
};

const AUDIT_TRAIL: NavItem = {
  key: "audit-trail",
  label: "Audit Trail",
  href: ROUTES.auditTrail,
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

const ALL_LOANS: NavItem = {
  ...DPD,
  label: "All Loans",
};

export function navFor(role: Role): NavItem[] {
  return role === "IMGC"
    ? [DASHBOARD, ACCOUNTS, ALL_LOANS, ADMINISTRATION]
    : [DASHBOARD, CLAIM, DPD, AUDIT_TRAIL];
}
