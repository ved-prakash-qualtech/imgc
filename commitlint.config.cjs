/**
 * Conventional Commits enforced at commit time (see .husky/commit-msg).
 * The scope-enum encodes Qualtech BFSI product domains so git history is
 * traceable to the workflow a change belongs to (audit / SOC 2 CC8.1).
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "los",
        "kyc",
        "credit",
        "leasing",
        "banking",
        "auth",
        "reports",
        "common",
        "infra",
        "deps",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
  },
};
