import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { themeStyle, type TenantTheme } from "@/lib/tenantTheme";

describe("tenantTheme", () => {
  const sampleTheme: TenantTheme = {
    brandPrimary: "#831843",
    brandDark: "#500724",
    brandMuted: "#fbcfe8",
    brandLight: "#fdf2f8",
  };

  it("produces complete CSS variable mappings for tenant brand overrides", () => {
    const style = themeStyle(sampleTheme) as Record<string, string>;

    // 1. Raw palette tokens
    expect(style["--brand-primary"]).toBe("#831843");
    expect(style["--brand-dark"]).toBe("#500724");
    expect(style["--brand-muted"]).toBe("#fbcfe8");
    expect(style["--brand-light"]).toBe("#fdf2f8");

    // 2. Tailwind utility tokens
    expect(style["--color-brand-primary"]).toBe("#831843");
    expect(style["--color-brand-dark"]).toBe("#500724");
    expect(style["--color-brand-muted"]).toBe("#fbcfe8");
    expect(style["--color-brand-light"]).toBe("#fdf2f8");

    // 3. shadcn/ui semantic mappings
    expect(style["--primary"]).toBe("#831843");
    expect(style["--ring"]).toBe("#831843");
    expect(style["--color-primary"]).toBe("#831843");
    expect(style["--color-ring"]).toBe("#831843");
    expect(style["--accent"]).toBe("#fdf2f8");
    expect(style["--accent-foreground"]).toBe("#831843");

    // 4. Gradient definitions
    expect(style["--grad-hero"]).toContain("#831843");
    expect(style["--grad-hero"]).toContain("#500724");
    expect(style["--grad-nav"]).toContain("#831843");
  });
});
