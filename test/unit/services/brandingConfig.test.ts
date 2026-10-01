import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AppSession } from "@imgc/lib/auth/appSession";
import {
  DEFAULT_BRAND_THEME,
  getGlobalBranding,
  getLenderBranding,
  listLendersForBranding,
  resetLenderBranding,
  updateLenderBranding,
  getUserPersonalization,
  updateUserPersonalization,
  resetUserPersonalization,
} from "@imgc/data/services/portal/brandingConfig.server";

const IMGC_SESSION: AppSession = {
  userId: "user_imgc_admin",
  role: "IMGC",
  isAdmin: true,
  name: "Meera Nair",
  email: "meera@imgc.com",
  issuedAt: 1700000000,
};

const LENDER_SESSION: AppSession = {
  userId: "usr_len1",
  role: "LENDER",
  isAdmin: false,
  name: "Arjun Sharma",
  email: "arjun@hdfcbank.com",
  lenderOrgId: "org_acme",
  issuedAt: 1700000000,
};

describe("brandingConfig service", () => {
  it("rejects non-IMGC users from listing lenders", async () => {
    const list = await listLendersForBranding(LENDER_SESSION);
    expect(list).toEqual([]);
  });

  it("allows IMGC users to list lenders", async () => {
    const list = await listLendersForBranding(IMGC_SESSION);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((l) => l.id === "org_acme")).toBe(true);
  });

  it("fetches default branding for a lender without overrides", async () => {
    const branding = await getLenderBranding(IMGC_SESSION, "org_acme");
    expect(branding).not.toBeNull();
    expect(branding?.id).toBe("org_acme");
    expect(branding?.name).toBe("HDFC Bank");
    expect(branding?.theme.brandPrimary).toBeDefined();
  });

  it("updates and persists custom branding for a lender by IMGC admin", async () => {
    const customTheme = {
      brandPrimary: "#004c8f",
      brandDark: "#002d5b",
      brandMuted: "#cfe2f3",
      brandLight: "#f0f6fc",
    };

    const updateRes = await updateLenderBranding(IMGC_SESSION, "org_acme", {
      portalTitle: "HDFC Custom Portal",
      logoUrl: "/assets/icons/hdfclogo.png",
      theme: customTheme,
    });

    expect(updateRes.ok).toBe(true);

    const updated = await getLenderBranding(IMGC_SESSION, "org_acme");
    expect(updated?.portalTitle).toBe("HDFC Custom Portal");
    expect(updated?.logoUrl).toBe("/assets/icons/hdfclogo.png");
    expect(updated?.theme.brandPrimary).toBe("#004c8f");
    expect(updated?.isCustom).toBe(true);
  });

  it("strictly forbids non-IMGC users from updating organization branding or logo", async () => {
    const forbiddenRes = await updateLenderBranding(
      LENDER_SESSION,
      "org_acme",
      {
        logoUrl: "/malicious-logo.png",
      }
    );

    expect(forbiddenRes.ok).toBe(false);
    expect(forbiddenRes.error).toContain("Only IMGC administrators");
  });

  it("validates invalid hex codes when updating", async () => {
    const invalidRes = await updateLenderBranding(IMGC_SESSION, "org_acme", {
      theme: {
        brandPrimary: "invalid-color",
      },
    });

    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.error).toContain("Invalid Primary Brand color hex code");
  });

  it("allows resetting branding back to system defaults", async () => {
    const resetRes = await resetLenderBranding(IMGC_SESSION, "org_acme");
    expect(resetRes.ok).toBe(true);

    const resetBranding = await getLenderBranding(IMGC_SESSION, "org_acme");
    expect(resetBranding?.portalTitle).toBe("HDFC Bank Portal");
    expect(resetBranding?.logoUrl).toBeUndefined();
    expect(resetBranding?.theme.brandPrimary).toBe(
      DEFAULT_BRAND_THEME.brandPrimary
    );
  });

  /* ── User-Level Personalization Tests ────────────────────────────── */
  it("retrieves personal appearance preferences for a user", async () => {
    const pref = await getUserPersonalization(LENDER_SESSION);
    expect(pref).toBeDefined();
    expect(pref.theme.brandPrimary).toBeDefined();
    expect(pref.colorMode).toBeDefined();
    expect(pref.language).toBe("en");
  });

  it("allows individual users to customize their theme, color mode, and custom colors", async () => {
    const updatePrefRes = await updateUserPersonalization(LENDER_SESSION, {
      colorMode: "dark",
      themeKey: "emerald-green",
      theme: {
        brandPrimary: "#059669",
        brandDark: "#047857",
        brandMuted: "#d1fae5",
        brandLight: "#ecfdf5",
      },
      customColors: {
        sidebarBg: "#0f2e22",
      },
      language: "hi",
      density: "compact",
    });

    expect(updatePrefRes.ok).toBe(true);

    const savedPref = await getUserPersonalization(LENDER_SESSION);
    expect(savedPref.colorMode).toBe("dark");
    expect(savedPref.themeKey).toBe("emerald-green");
    expect(savedPref.theme.brandPrimary).toBe("#059669");
    expect(savedPref.customColors.sidebarBg).toBe("#0f2e22");
    expect(savedPref.language).toBe("hi");
    expect(savedPref.density).toBe("compact");
    expect(savedPref.isCustom).toBe(true);
  });

  it("resets user personalization to inherit organization defaults", async () => {
    const resetUserRes = await resetUserPersonalization(LENDER_SESSION);
    expect(resetUserRes.ok).toBe(true);

    const resetPref = await getUserPersonalization(LENDER_SESSION);
    expect(resetPref.isCustom).toBe(false);
  });

  /* ── Dual Logo & Separation Tests ────────────────────────────────── */
  it("allows IMGC admin to update the global IMGC master logo", async () => {
    const res = await updateLenderBranding(IMGC_SESSION, "org_acme", {
      imgcLogoUrl: "/assets/icons/new-imgc-flower.svg",
    });
    expect(res.ok).toBe(true);

    const global = await getGlobalBranding();
    expect(global.imgcLogoUrl).toBe("/assets/icons/new-imgc-flower.svg");

    const userPref = await getUserPersonalization(LENDER_SESSION);
    expect(userPref.imgcLogoUrl).toBe("/assets/icons/new-imgc-flower.svg");
  });

  it("updates lender logo without altering or overwriting lender theme", async () => {
    // 1. First record original lender theme
    const before = await getLenderBranding(IMGC_SESSION, "org_acme");
    const originalPrimary = before?.theme.brandPrimary;

    // 2. Update lender logo only
    const updateLogoRes = await updateLenderBranding(IMGC_SESSION, "org_acme", {
      logoUrl: "/assets/icons/hdfclogo.png",
      portalTitle: "HDFC Dedicated Portal",
    });
    expect(updateLogoRes.ok).toBe(true);

    // 3. Confirm logo changed but theme was preserved untouched
    const after = await getLenderBranding(IMGC_SESSION, "org_acme");
    expect(after?.logoUrl).toBe("/assets/icons/hdfclogo.png");
    expect(after?.portalTitle).toBe("HDFC Dedicated Portal");
    expect(after?.theme.brandPrimary).toBe(originalPrimary);
  });
});
