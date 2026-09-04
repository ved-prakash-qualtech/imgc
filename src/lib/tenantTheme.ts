import "server-only";
import { findRegistryTenant } from "@/server/standInRegistry";

/**
 * Per-tenant theming (nextjs-multitenant-template.md §3, design system §6):
 * tenant branding is a BRAND-token override map — components keep using the
 * miFIN™ token names and never branch on tenant. Only the four brand tokens
 * (+ logo in real products) are overridable; neutrals, semantic colors,
 * spacing, radius and components stay locked to the design system.
 *
 * Stand-in source: the demo registry. Real products load this from the
 * tenant configuration API at the same point in the layout.
 */
export interface TenantTheme {
  brandPrimary: string;
  brandDark: string;
  brandMuted: string;
  brandLight: string;
}

const DEFAULT_THEME: TenantTheme = {
  brandPrimary: "#0466c8",
  brandDark: "#044b95",
  brandMuted: "#d4e4fb",
  brandLight: "#eef6ff",
};

export async function getTenantTheme(tenant: string | null): Promise<TenantTheme> {
  const registryTenant = findRegistryTenant(tenant);
  return registryTenant?.theme ?? DEFAULT_THEME;
}

/** CSS custom-property overrides applied at the <html> level by the root layout. */
export function themeStyle(theme: TenantTheme): React.CSSProperties {
  return {
    "--color-brand-primary": theme.brandPrimary,
    "--color-brand-dark": theme.brandDark,
    "--color-brand-muted": theme.brandMuted,
    "--color-brand-light": theme.brandLight,
    "--grad-hero": `linear-gradient(135deg, ${theme.brandPrimary} 0%, ${theme.brandDark} 100%)`,
    "--grad-nav": `linear-gradient(90deg, #1e293b 0%, ${theme.brandPrimary} 100%)`,
  } as React.CSSProperties;
}
