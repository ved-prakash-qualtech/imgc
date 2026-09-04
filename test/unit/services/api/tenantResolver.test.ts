import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("axios", () => ({ default: {} }));
vi.mock("@/lib/serverEnv", () => ({
  getServerEnv: vi.fn(),
}));

import { resolveTenantFromHost } from "@/lib/tenantHost";
import { getHostnamePrefixFromHost } from "@/services/api/tenantResolver";

describe("getHostnamePrefixFromHost", () => {
  it("matches resolveTenantFromHost for host strings", () => {
    const hosts = [
      "qc-app-local.qualtechedge.in",
      "client1-app-local.qualtechedge.in",
      "admin-app-local.qualtechedge.in",
      "localhost:3000",
    ];

    for (const host of hosts) {
      expect(getHostnamePrefixFromHost(host)).toBe(resolveTenantFromHost(host));
    }
  });

  it("returns null for a null host", () => {
    expect(getHostnamePrefixFromHost(null)).toBeNull();
  });
});
