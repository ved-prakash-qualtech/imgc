# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **infra:** pnpm 11.8 / Node ≥24.17 engines, `pnpm-workspace.yaml` CVE overrides,
  Stylelint, `skills-lock.json`, `build:analyze`, `audit`/`audit:ci`,
  `test:storybook`, GitLab CI quality/test/security stages.
- **infra:** `SECURITY.md` and `SECURITY-CVE-REPORT.md`.
- **common:** next-intl locale routing (`en`/`hi`, `as-needed` prefix) with
  composed Host-tenant + locale proxy.
- **infra:** optional `@sentry/nextjs` (instrumentation, tunnel `/monitoring`,
  logging sink, tenant tags).
- **common:** Storybook Vitest smoke (`@storybook/addon-vitest`), DocumentViewer
  and LocaleSwitcher stories.

### Changed

- **infra:** removed empty `test/integration` and `test/e2e` placeholders,
  related npm scripts, and `playwright.config.ts` (Playwright Chromium remains
  for Storybook smoke via `pnpm exec playwright install chromium`).
- **common:** `FormStoryShell` wraps stories in RHF `Form` provider so Storybook
  smoke can use `FormLabel` / `useFormContext`.
- **infra:** Docker `Dockerfile.dev` CMD uses `pnpm dev:no-open` (matches Compose docs).
- **infra:** baseline security headers aligned with the base template (CSP,
  Permissions-Policy, standalone output, bundle analyzer, React Compiler).
- **infra:** ESLint path-alias ban, jsx-a11y, react-perf, storybook, Prettier;
  lint-staged batches + `.env` guard.
- **deps:** removed unused `i18next` / `react-i18next`; bumped axios and Next.
- **common:** tenant Host parsing deduped onto `tenantHost`; shared SSR HTTP
  timeout; `getServerEnv` logs via `@/lib/logging` and Zod-validates the
  merged `ServerEnv`.

### Security

- Hardened CSP (`blob:` workers for PDF, Sentry `connect-src`, prod without
  `'unsafe-eval'`); dependency overrides for known transitive advisories.
