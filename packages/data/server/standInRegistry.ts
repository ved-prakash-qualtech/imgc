import "server-only";

/**
 * STAND-IN tenant registry so the template runs standalone — the real registry
 * lives in the QCP backend system DB (tenant.tenants) and is served by the
 * super-admin API (`/api/v1/tenants/active`). Delete this module in a real
 * product; resolveTenantDataSSR then talks to the real super admin.
 */
export interface RegistryTenant {
  id: string;
  name: string;
  shortCode: string;
  defaultApiClientId: string;
  defaultApiClientSecret: string;
  /** Per-tenant branding — miFIN™ BRAND token overrides only (design system §6). */
  theme: {
    brandPrimary: string;
    brandDark: string;
    brandMuted: string;
    brandLight: string;
  };
}

/**
 * One tenant, deliberately. `client1` used to ship alongside `qc` to demonstrate per-tenant
 * brand theming; it was removed so a clone starts with nothing to clean up. The capability is
 * unchanged — add an entry and its `theme` overrides apply, which is what the commented block
 * below is for. Note `admin` is never a tenant here: `admin-*` resolves to the system scope.
 */
export const DEMO_TENANTS: RegistryTenant[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Qualtech",
    shortCode: "qc",
    defaultApiClientId: "tenant_default_qc_client",
    defaultApiClientSecret: "qc-demo-secret",
    // qc keeps the default miFIN™ brand
    theme: {
      brandPrimary: "#0466c8",
      brandDark: "#044b95",
      brandMuted: "#d4e4fb",
      brandLight: "#eef6ff",
    },
  },
  // A second tenant, with its own brand — the theming demo, if you want it back:
  // {
  //   id: "22222222-2222-2222-2222-222222222222",
  //   name: "Client One",
  //   shortCode: "client1",
  //   defaultApiClientId: "tenant_default_client1_client",
  //   defaultApiClientSecret: "client1-demo-secret",
  //   theme: { brandPrimary: "#7c3aed", brandDark: "#5b21b6", brandMuted: "#ede9fe", brandLight: "#f5f3ff" },
  // },
];

export function findRegistryTenant(
  shortCode: string | null
): RegistryTenant | null {
  if (!shortCode) return null;
  return DEMO_TENANTS.find((tenant) => tenant.shortCode === shortCode) ?? null;
}
