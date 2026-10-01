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

export interface CustomColorOverrides {
  primary?: string;
  sidebarBg?: string;
  sidebarText?: string;
  sidebarActive?: string;
  chartAccent?: string;
}

/** CSS custom-property overrides applied at the <html> or shell container level. */
export function themeStyle(
  theme: TenantTheme,
  customColors?: CustomColorOverrides
): React.CSSProperties {
  const primary = customColors?.primary || theme.brandPrimary;
  const dark = theme.brandDark;
  const muted = theme.brandMuted;
  const light = theme.brandLight;

  return {
    // 1. miFIN™ raw brand tokens (palette & SVG variables)
    "--brand-primary": primary,
    "--brand-dark": dark,
    "--brand-muted": muted,
    "--brand-light": light,

    // 2. Tailwind v4 utility tokens
    "--color-brand-primary": primary,
    "--color-brand-dark": dark,
    "--color-brand-muted": muted,
    "--color-brand-light": light,

    // 3. Custom component colors (sidebar, chart)
    ...(customColors?.sidebarBg ? { "--sidebar-bg": customColors.sidebarBg } : {}),
    ...(customColors?.sidebarText ? { "--sidebar-text-muted": customColors.sidebarText } : {}),
    ...(customColors?.chartAccent ? { "--chart-accent": customColors.chartAccent } : {}),

    // 4. shadcn/ui semantic tokens (Buttons, rings, accents)
    "--primary": primary,
    "--primary-foreground": "#ffffff",
    "--color-primary": primary,
    "--color-primary-foreground": "#ffffff",

    "--ring": primary,
    "--color-ring": primary,

    "--accent": light,
    "--accent-foreground": primary,
    "--color-accent": light,
    "--color-accent-foreground": primary,

    // 5. Hero and Navigation gradients
    "--grad-hero": `linear-gradient(115deg, ${dark} 0%, ${primary} 55%, ${dark} 100%)`,
    "--grad-band": `linear-gradient(115deg, ${dark} 0%, ${primary} 55%, ${dark} 100%)`,
    "--grad-nav": `linear-gradient(90deg, #1e293b 0%, ${primary} 100%)`,
  } as React.CSSProperties;
}

