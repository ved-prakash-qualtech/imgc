/** App route constants — keep navigation paths out of component literals. */
export const ROUTES = {
  home: "/",
  login: "/login",
  /** Where signing in lands, in every role. */
  dashboard: "/dashboard",

  /* ── IMGC Lender Portal ─────────────────────────────────────────── */
  accounts: "/accounts",
  /** One account's claim workspace (Overview / Accounting / Documents / Audit). */
  account: (accountId: string) => `/accounts/${accountId}`,
  /** All lender-eligible accounts by Days Past Due — not restricted to NPA, unlike the claim
   *  grid. A second lens on the same accounts, not a second account/claim model. */
  dpd: "/dpd",

  /* ── Lender specific screens ── */
  /** "Claim" in the sidebar — initiating a claim and tracking one are the same grid now, not
   *  two separate tabs. `/track-query-response` redirects here for anything still pointing at
   *  the old URL. */
  initiateClaim: "/initiate-claim",
  initiateClaimWorkspace: (accountId: string) => `/initiate-claim/${accountId}`,

  /** @deprecated alias of `initiateClaim`, kept only so old links/bookmarks still land somewhere. */
  trackQueryResponse: "/initiate-claim",
  /** One claim's detail + timeline, reachable by both roles. */
  claimDetails: (claimId: string) => `/claims/${claimId}`,

  auditTrail: "/audit-trail",
  auditTrailWorkspace: (accountId: string) => `/audit-trail/${accountId}`,

  /** @deprecated the dedicated bulk-move screen is gone — `BucketToggle` on each account's own
   *  Overview tab does the same move, from wherever the decision is actually made. Kept only so
   *  an old link/bookmark redirects somewhere instead of 404ing. */
  buckets: "/buckets",
  /** IMGC — the cross-case additional-documents workbench. */
  additionalDocuments: "/additional-documents",
  notifications: "/notifications",
  /** IMGC only — provision lender access. */
  adminUsers: "/admin/users",
  /** IMGC only — rejected-document retention + reinstatement approvals. */
  adminRetention: "/admin/retention",
  logout: "/api/auth/logout",

  /* ── retained from the base template (unused by the portal nav) ── */
  examples: "/examples",
  tenants: "/tenants",
  menus: "/layout",
  roles: "/roles",
  users: "/users",
  apiClients: "/api-clients",
} as const;
