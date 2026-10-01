import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import type { AppSession } from "@/lib/auth/appSession";
import type { LenderCustomColors, LenderTheme, UserPersonalization } from "@/server/mock/types";
import { DEFAULT_BRAND_THEME, THEME_PRESETS } from "@/constants/branding";

export type Outcome = Readonly<{ ok: boolean; error?: string }>;
export { DEFAULT_BRAND_THEME };

export interface LenderBrandingData {
  id: string;
  name: string;
  logoUrl?: string;
  imgcLogoUrl?: string;
  portalTitle?: string;
  theme: LenderTheme;
  isCustom: boolean;
}

export interface UserPersonalizationData {
  colorMode: "light" | "dark" | "system";
  themeKey: string;
  theme: LenderTheme;
  customColors: LenderCustomColors;
  bgPattern: string;
  language: string;
  density: "comfortable" | "compact" | "spacious" | "executive" | "presentation";
  highContrast?: boolean;
  largeClickTargets?: boolean;
  isCustom: boolean;
  /** Effective institutional logo (always read-only for users) */
  institutionalLogoUrl?: string;
  /** Effective IMGC master brand logo mark (always read-only for users) */
  imgcLogoUrl?: string;
  institutionalName: string;
}

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function isValidHex(color?: string): boolean {
  if (!color) return false;
  return HEX_COLOR_REGEX.test(color.trim());
}

/** Lists all available lender organizations for the branding dropdown. IMGC staff only. */
export async function listLendersForBranding(
  session: AppSession
): Promise<{ id: string; name: string }[]> {
  if (session.role !== "IMGC") return [];
  const db = await readDb();
  return db.lenderOrgs
    .map((o) => ({ id: o.id, name: o.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns branding details for a lender. If custom colors/titles have not been saved yet,
 * returns defaults with `isCustom: false`. IMGC staff only.
 */
export async function getLenderBranding(
  session: AppSession,
  lenderOrgId: string
): Promise<LenderBrandingData | null> {
  if (session.role !== "IMGC") return null;
  const db = await readDb();
  const lender = db.lenderOrgs.find((o) => o.id === lenderOrgId);
  if (!lender) return null;

  const hasCustomTheme = Boolean(lender.theme?.brandPrimary);
  const theme: LenderTheme = hasCustomTheme && lender.theme
    ? {
        brandPrimary: lender.theme.brandPrimary,
        brandDark: lender.theme.brandDark,
        brandMuted: lender.theme.brandMuted,
        brandLight: lender.theme.brandLight,
        colorMode: lender.theme.colorMode ?? "light",
        themeKey: lender.theme.themeKey ?? "qualtech",
        customColors: lender.theme.customColors ?? {},
        bgPattern: lender.theme.bgPattern ?? "clean",
        density: lender.theme.density ?? "comfortable",
        highContrast: lender.theme.highContrast ?? false,
        largeClickTargets: lender.theme.largeClickTargets ?? false,
      }
    : { ...DEFAULT_BRAND_THEME };

  const imgcLogoUrl = db.globalBranding?.imgcLogoUrl || "/assets/icons/imgc-mark.svg";
  return {
    id: lender.id,
    name: lender.name,
    logoUrl: lender.logoUrl,
    imgcLogoUrl,
    portalTitle: lender.portalTitle ?? `${lender.name} Portal`,
    theme,
    isCustom: hasCustomTheme || Boolean(lender.portalTitle) || Boolean(lender.logoUrl) || Boolean(db.globalBranding?.imgcLogoUrl),
  };
}

/**
 * Saves branding configuration for a lender organization.
 * Validates color hex codes and updates the lender in MockDb.
 * RESTRICTED: IMGC administrators ONLY.
 */
export async function updateLenderBranding(
  session: AppSession,
  lenderOrgId: string,
  input: {
    logoUrl?: string;
    imgcLogoUrl?: string;
    portalTitle?: string;
    theme?: Partial<LenderTheme>;
  }
): Promise<Outcome> {
  if (session.role !== "IMGC") {
    return { ok: false, error: "Only IMGC administrators can configure organization branding and logos." };
  }

  // Validate theme colors if provided
  if (input.theme) {
    const { brandPrimary, brandDark, brandMuted, brandLight, customColors } = input.theme;
    if (brandPrimary && !isValidHex(brandPrimary)) {
      return { ok: false, error: "Invalid Primary Brand color hex code." };
    }
    if (brandDark && !isValidHex(brandDark)) {
      return { ok: false, error: "Invalid Dark Brand color hex code." };
    }
    if (brandMuted && !isValidHex(brandMuted)) {
      return { ok: false, error: "Invalid Muted Brand color hex code." };
    }
    if (brandLight && !isValidHex(brandLight)) {
      return { ok: false, error: "Invalid Light Brand color hex code." };
    }
    if (customColors) {
      for (const [key, val] of Object.entries(customColors)) {
        if (val && !isValidHex(val)) {
          return { ok: false, error: `Invalid hex code for ${key}.` };
        }
      }
    }
  }

  let found = false;

  await writeDb((db) => {
    const index = db.lenderOrgs.findIndex((o) => o.id === lenderOrgId);
    if (index === -1) return;
    found = true;

    const existing = db.lenderOrgs[index]!;
    const mergedTheme: LenderTheme = {
      brandPrimary: input.theme?.brandPrimary || existing.theme?.brandPrimary || DEFAULT_BRAND_THEME.brandPrimary,
      brandDark: input.theme?.brandDark || existing.theme?.brandDark || DEFAULT_BRAND_THEME.brandDark,
      brandMuted: input.theme?.brandMuted || existing.theme?.brandMuted || DEFAULT_BRAND_THEME.brandMuted,
      brandLight: input.theme?.brandLight || existing.theme?.brandLight || DEFAULT_BRAND_THEME.brandLight,
      colorMode: input.theme?.colorMode || existing.theme?.colorMode || "light",
      themeKey: input.theme?.themeKey || existing.theme?.themeKey || "qualtech",
      customColors: input.theme?.customColors || existing.theme?.customColors || {},
      bgPattern: input.theme?.bgPattern || existing.theme?.bgPattern || "clean",
      density: input.theme?.density || existing.theme?.density || "comfortable",
      highContrast: input.theme?.highContrast ?? existing.theme?.highContrast ?? false,
      largeClickTargets: input.theme?.largeClickTargets ?? existing.theme?.largeClickTargets ?? false,
    };

    if (input.imgcLogoUrl !== undefined) {
      db.globalBranding = {
        ...db.globalBranding,
        imgcLogoUrl: input.imgcLogoUrl.trim() || undefined,
      };
    }

    db.lenderOrgs[index] = {
      ...existing,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl.trim() : existing.logoUrl,
      portalTitle: input.portalTitle !== undefined ? input.portalTitle.trim() : existing.portalTitle,
      theme: input.theme ? mergedTheme : existing.theme,
    };
  });

  if (!found) {
    return { ok: false, error: "Lender organization not found." };
  }

  return { ok: true };
}

/**
 * Resets a lender's branding back to IMGC system defaults. IMGC staff only.
 */
export async function resetLenderBranding(
  session: AppSession,
  lenderOrgId: string
): Promise<Outcome> {
  if (session.role !== "IMGC") {
    return { ok: false, error: "Only IMGC administrators can reset branding." };
  }

  let found = false;

  await writeDb((db) => {
    const index = db.lenderOrgs.findIndex((o) => o.id === lenderOrgId);
    if (index === -1) return;
    found = true;

    const existing = db.lenderOrgs[index]!;
    db.lenderOrgs[index] = {
      ...existing,
      logoUrl: undefined,
      portalTitle: undefined,
      theme: undefined,
    };
  });

  if (!found) {
    return { ok: false, error: "Lender organization not found." };
  }

  return { ok: true };
}

/** Returns the global IMGC branding (e.g. system master logo). */
export async function getGlobalBranding(): Promise<{ imgcLogoUrl: string }> {
  const db = await readDb();
  return {
    imgcLogoUrl: db.globalBranding?.imgcLogoUrl || "/assets/icons/imgc-mark.svg",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   USER-LEVEL PERSONALIZATION (Appearance Studio for individual users)
   Rule: Users can customize their themes, color modes, custom swatches,
   and display language, but CANNOT change the institutional logo.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Retrieves the current user's personal appearance settings.
 * Falls back to their organization's branding if no user override exists.
 */
export async function getUserPersonalization(
  session: AppSession
): Promise<UserPersonalizationData> {
  const db = await readDb();
  const user = db.users.find(
    (u) =>
      u.id === session.userId ||
      (session.email && u.email.toLowerCase() === session.email.toLowerCase())
  );
  const lender = session.lenderOrgId
    ? db.lenderOrgs.find((o) => o.id === session.lenderOrgId)
    : null;

  const orgTheme = lender?.theme ?? DEFAULT_BRAND_THEME;
  const userP = user?.personalization;

  const effectiveTheme: LenderTheme = userP?.theme ?? {
    brandPrimary: orgTheme.brandPrimary,
    brandDark: orgTheme.brandDark,
    brandMuted: orgTheme.brandMuted,
    brandLight: orgTheme.brandLight,
    colorMode: orgTheme.colorMode ?? "light",
    themeKey: orgTheme.themeKey ?? "qualtech",
    customColors: orgTheme.customColors ?? {},
    bgPattern: orgTheme.bgPattern ?? "clean",
    density: orgTheme.density ?? "comfortable",
  };

  return {
    colorMode: userP?.colorMode ?? orgTheme.colorMode ?? "light",
    themeKey: userP?.themeKey ?? orgTheme.themeKey ?? "qualtech",
    theme: effectiveTheme,
    customColors: userP?.customColors ?? orgTheme.customColors ?? {},
    bgPattern: userP?.bgPattern ?? orgTheme.bgPattern ?? "clean",
    language: userP?.language ?? "en",
    density: userP?.density ?? orgTheme.density ?? "comfortable",
    highContrast: userP?.highContrast ?? orgTheme.highContrast ?? false,
    largeClickTargets: userP?.largeClickTargets ?? orgTheme.largeClickTargets ?? false,
    isCustom: Boolean(userP && Object.keys(userP).length > 0),
    institutionalLogoUrl: lender?.logoUrl,
    imgcLogoUrl: db.globalBranding?.imgcLogoUrl || "/assets/icons/imgc-mark.svg",
    institutionalName: lender?.name ?? (session.role === "IMGC" ? "IMGC Operations" : "Lender Portal"),
  };
}

/**
 * Updates the current user's personal appearance settings in MockDb.
 * NOTE: Does NOT allow updating logoUrl or portalTitle.
 */
export async function updateUserPersonalization(
  session: AppSession,
  input: {
    colorMode?: "light" | "dark" | "system";
    themeKey?: string;
    theme?: Partial<LenderTheme>;
    customColors?: LenderCustomColors;
    bgPattern?: string;
    language?: string;
    density?: "comfortable" | "compact" | "spacious" | "executive" | "presentation";
    highContrast?: boolean;
    largeClickTargets?: boolean;
  }
): Promise<Outcome> {
  if (!session.userId) {
    return { ok: false, error: "Authentication required to personalize appearance." };
  }

  // Validate custom colors if provided
  if (input.customColors) {
    for (const [key, val] of Object.entries(input.customColors)) {
      if (val && !isValidHex(val)) {
        return { ok: false, error: `Invalid color code for ${key}.` };
      }
    }
  }

  let found = false;

  await writeDb((db) => {
    const userIndex = db.users.findIndex(
      (u) =>
        u.id === session.userId ||
        (session.email && u.email.toLowerCase() === session.email.toLowerCase())
    );
    if (userIndex === -1) return;
    found = true;

    const existingUser = db.users[userIndex]!;
    const existingP = existingUser.personalization ?? {};

    // Match preset theme if themeKey is passed
    const preset = input.themeKey ? THEME_PRESETS.find((p) => p.id === input.themeKey) : null;
    const baseTheme = preset ? preset.theme : (input.theme ? input.theme : (existingP.theme ?? DEFAULT_BRAND_THEME));

    const updatedPersonalization: UserPersonalization = {
      ...existingP,
      colorMode: input.colorMode ?? existingP.colorMode ?? "light",
      themeKey: input.themeKey ?? existingP.themeKey ?? "qualtech",
      theme: {
        brandPrimary: input.theme?.brandPrimary ?? baseTheme.brandPrimary ?? DEFAULT_BRAND_THEME.brandPrimary,
        brandDark: input.theme?.brandDark ?? baseTheme.brandDark ?? DEFAULT_BRAND_THEME.brandDark,
        brandMuted: input.theme?.brandMuted ?? baseTheme.brandMuted ?? DEFAULT_BRAND_THEME.brandMuted,
        brandLight: input.theme?.brandLight ?? baseTheme.brandLight ?? DEFAULT_BRAND_THEME.brandLight,
        colorMode: input.colorMode ?? existingP.colorMode ?? "light",
        themeKey: input.themeKey ?? existingP.themeKey ?? "qualtech",
      },
      customColors: input.customColors ?? existingP.customColors ?? {},
      bgPattern: input.bgPattern ?? existingP.bgPattern ?? "clean",
      language: input.language ?? existingP.language ?? "en",
      density: input.density ?? existingP.density ?? "comfortable",
      highContrast: input.highContrast ?? input.theme?.highContrast ?? existingP.highContrast ?? false,
      largeClickTargets: input.largeClickTargets ?? input.theme?.largeClickTargets ?? existingP.largeClickTargets ?? false,
      updatedAt: new Date().toISOString(),
    };

    db.users[userIndex] = {
      ...existingUser,
      personalization: updatedPersonalization,
    };
  });

  if (!found) {
    return { ok: false, error: "User record not found." };
  }

  return { ok: true };
}

/**
 * Resets the current user's personal appearance settings to inherit their organization's defaults.
 */
export async function resetUserPersonalization(
  session: AppSession
): Promise<Outcome> {
  if (!session.userId) {
    return { ok: false, error: "Authentication required." };
  }

  let found = false;

  await writeDb((db) => {
    const userIndex = db.users.findIndex(
      (u) =>
        u.id === session.userId ||
        (session.email && u.email.toLowerCase() === session.email.toLowerCase())
    );
    if (userIndex === -1) return;
    found = true;

    const existingUser = db.users[userIndex]!;
    db.users[userIndex] = {
      ...existingUser,
      personalization: undefined,
    };
  });

  if (!found) {
    return { ok: false, error: "User record not found." };
  }

  return { ok: true };
}
