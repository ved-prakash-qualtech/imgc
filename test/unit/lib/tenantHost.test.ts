import { describe, expect, it } from "vitest";

import {
  ADMIN_ALLOWED_PREFIXES,
  isAdminAllowedPath,
  isTenantExcludedPath,
  resolveHostScope,
  resolveTenantFromHost,
  stripLocalePrefix,
} from "@/lib/tenantHost";

describe("tenantHost", () => {
  describe("resolveTenantFromHost", () => {
    it("extracts tenant from subdomain host", () => {
      expect(resolveTenantFromHost("qc-app-local.qualtechedge.in")).toBe("qc");
      expect(resolveTenantFromHost("client1-app-local.qualtechedge.in")).toBe(
        "client1"
      );
    });

    it("returns null for admin hosts and unknown shapes", () => {
      expect(
        resolveTenantFromHost("admin-app-local.qualtechedge.in")
      ).toBeNull();
      expect(resolveTenantFromHost("localhost:3000")).toBeNull();
    });
  });

  describe("stripLocalePrefix", () => {
    it("strips non-default locale prefix", () => {
      expect(stripLocalePrefix("/hi/examples")).toBe("/examples");
      expect(stripLocalePrefix("/hi")).toBe("/");
    });

    it("leaves default-locale paths unchanged", () => {
      expect(stripLocalePrefix("/examples")).toBe("/examples");
      expect(stripLocalePrefix("/")).toBe("/");
    });
  });

  describe("isTenantExcludedPath", () => {
    it("treats home and registry paths as system scope", () => {
      expect(isTenantExcludedPath("/")).toBe(true);
      expect(isTenantExcludedPath("/admin")).toBe(true);
      expect(isTenantExcludedPath("/api/v1/tenants/active")).toBe(true);
      expect(isTenantExcludedPath("/monitoring")).toBe(true);
    });

    it("requires tenant for product routes", () => {
      expect(isTenantExcludedPath("/examples")).toBe(false);
    });
  });

  describe("isAdminAllowedPath", () => {
    // The admin host resolves no tenant, so this allowlist is the only thing standing between
    // an admin screen and a 403. A service built from this template that copies the file and
    // drops entries loses those screens silently — the host still resolves, sign-in still
    // works, and only the pages left in the list render. Assert the whole set, so a truncated
    // copy fails here rather than in someone's browser.
    it("admits every admin screen the template ships", () => {
      for (const path of [
        "/login",
        "/dashboard",
        "/tenants",
        "/layout",
        "/roles",
        "/users",
        "/api-clients",
      ]) {
        expect(isAdminAllowedPath(path)).toBe(true);
      }
      expect(ADMIN_ALLOWED_PREFIXES).toHaveLength(7);
    });

    it("matches nested paths under an allowed prefix", () => {
      expect(isAdminAllowedPath("/tenants/new")).toBe(true);
      expect(isAdminAllowedPath("/users/42/edit")).toBe(true);
    });

    it("still refuses tenant-scoped product routes", () => {
      expect(isAdminAllowedPath("/examples")).toBe(false);
    });
  });

  describe("hosts that carry a location segment", () => {
    // Only the first three segments are addressed; a fourth names where the estate put the box.
    it("keeps admin and tenant scope on a located hostname", () => {
      expect(resolveHostScope("admin-app-uat-onprem.qualtechedge.in")).toBe(
        "ADMIN"
      );
      expect(resolveTenantFromHost("qc-app-uat-onprem.qualtechedge.in")).toBe(
        "qc"
      );
    });
  });
});
