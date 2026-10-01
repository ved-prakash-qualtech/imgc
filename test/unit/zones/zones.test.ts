// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ZONE_PATHS,
  currentZone,
  stripLocale,
  zoneOfPath,
} from "@imgc/i18n/zones";

const root = path.resolve(__dirname, "../../..");

/** The shell proxy's matcher, turned into the regular expression Next builds from it. */
function shellMatcher(): RegExp {
  const source = readFileSync(
    path.join(root, "apps/shell/src/proxy.ts"),
    "utf8"
  );
  const literal = /matcher:\s*\[\s*"([^\n]*)",?\s*\]/.exec(source)?.[1];
  if (!literal)
    throw new Error("could not find the matcher in the shell proxy");
  // The file holds a JS string literal, so `\\.` there is the regex `\.`.
  // eslint-disable-next-line security/detect-non-literal-regexp -- the pattern comes from this repository's own proxy file
  return new RegExp(`^${literal.replace(/\\\\/g, "\\")}$`);
}

describe("zone routing", () => {
  it("assigns every listed path to exactly one zone", () => {
    const seen = new Map<string, string>();
    for (const [zone, list] of Object.entries(ZONE_PATHS)) {
      for (const p of list) {
        expect(seen.has(p), `${p} is claimed by two zones`).toBe(false);
        seen.set(p, zone);
      }
    }
  });

  it("resolves a path to its zone, with or without a locale prefix", () => {
    expect(zoneOfPath("/accounts/acc_1?x=1")).toBe("claims");
    expect(zoneOfPath("/hi/claim-dashboard")).toBe("claims");
    expect(zoneOfPath("/dpd")).toBe("loans");
    expect(zoneOfPath("/hi/admin/users")).toBe("admin");
    expect(zoneOfPath("/login")).toBe("shell");
    expect(zoneOfPath("/")).toBe("shell");
  });

  it("does not let a prefix swallow a similarly named path", () => {
    // `/claims` is a claims-zone prefix; `/claims-archive` is not under it.
    expect(zoneOfPath("/claims-archive")).toBe("shell");
    expect(zoneOfPath("/claims/clm_1")).toBe("claims");
  });

  it("strips only a non-default locale prefix", () => {
    expect(stripLocale("/hi/accounts")).toBe("/accounts");
    expect(stripLocale("/hi")).toBe("/");
    expect(stripLocale("/accounts")).toBe("/accounts");
  });

  it("treats an unset NEXT_PUBLIC_ZONE as the shell", () => {
    expect(currentZone()).toBe("shell");
  });
});

describe("shell proxy matcher", () => {
  const matcher = shellMatcher();

  it("leaves every zone path to that zone's own proxy", () => {
    for (const p of Object.values(ZONE_PATHS).flat()) {
      for (const candidate of [p, `${p}/x`, `/hi${p}`, `/hi${p}/x`]) {
        expect(
          matcher.test(candidate),
          `${candidate} must not run through the shell proxy`
        ).toBe(false);
      }
    }
  });

  it("still runs the shell's own paths through the proxy", () => {
    for (const p of ["/", "/login", "/hi", "/hi/login"]) {
      expect(matcher.test(p), `${p} must run through the shell proxy`).toBe(
        true
      );
    }
  });

  it("skips api and asset requests", () => {
    for (const p of ["/api/auth/login", "/_next/static/x.js", "/icon.svg"]) {
      expect(matcher.test(p), p).toBe(false);
    }
  });
});
