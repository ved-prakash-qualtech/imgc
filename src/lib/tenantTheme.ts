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

/**
 * `null` means "no override": the product's own brand tokens in `styles/theme/colors.css` stand.
 * Returning a default here instead would repaint every tenant-less environment — local
 * development and any single-brand deployment — in whatever that default happened to be.
 */
export async function getTenantTheme(
  tenant: string | null
): Promise<TenantTheme | null> {
  return findRegistryTenant(tenant)?.theme ?? null;
}

/** CSS custom-property overrides applied at the <html> level by the root layout. */
export function themeStyle(theme: TenantTheme): React.CSSProperties {
  return {
    // The four source variables. `--color-brand-*` (Tailwind utilities), `--ring`, `--primary`,
    // `--accent` and the chart palette all derive from these in globals.css, so overriding the
    // source re-themes everything that follows from it — no component names a colour.
    "--brand-primary": theme.brandPrimary,
    "--brand-dark": theme.brandDark,
    "--brand-muted": theme.brandMuted,
    "--brand-light": theme.brandLight,
    "--grad-hero": `linear-gradient(135deg, ${theme.brandPrimary} 0%, ${theme.brandDark} 100%)`,
    "--grad-nav": `linear-gradient(90deg, #1e293b 0%, ${theme.brandPrimary} 100%)`,
  } as React.CSSProperties;
}
