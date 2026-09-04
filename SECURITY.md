# Security Policy

This multitenant template is built for **BFSI** products and ships secure-by-default.
It is designed to support **SOC 2 (Type II)** and **ISO/IEC 27001** controls.

---

## Reporting a Vulnerability

- **Do not** open a public issue for security vulnerabilities.
- Email **`security@qualtech.example`** with a description, reproduction steps,
  and impact assessment.
- You will receive an acknowledgement within **2 business days**.
- Coordinated disclosure: please allow up to **90 days** before public
  disclosure.

---

## Secure Defaults in This Template

| Area                  | Control                                                                                                                         | Where                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| HTTP security headers | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader: false` | `next.config.ts`                                                                    |
| Tenant isolation      | Host-only tenant identity; deny-by-default `QT-TEN-403`; strip inbound `x-tenant`                                               | `src/proxy.ts`, `src/lib/tenantHost.ts`                                             |
| Auth tokens           | `httpOnly`, `secure`, `sameSite=strict` cookies; no tokens in `localStorage`                                                    | `src/constants/authCookies.ts`                                                      |
| Secrets               | Zod-validated `env` singleton; Vault via `getServerEnv()`; only `.env.example` committed                                        | `src/lib/utils/env`, `src/lib/serverEnv.ts`, `scripts/lintStaged/guardEnvFiles.mjs` |
| Error handling        | App/widget error boundaries; optional Sentry; never raw stack traces to users                                                   | `WidgetErrorBoundary`, `src/lib/logging`                                            |
| Static analysis       | ESLint `eslint-plugin-security`, GitLab SAST + Secret Detection + Dependency Scanning                                           | `eslint.config.mjs`, `.gitlab-ci.yml`                                               |

---

## Dependency & Vulnerability Management

- **CVE scanning gates the build.** `pnpm audit:ci` fails CI on `high`/`critical`
  advisories in production dependencies.
- **Transitive CVE remediation:** `overrides` in `pnpm-workspace.yaml` (pnpm 11+).
- Current advisory snapshot: see [`SECURITY-CVE-REPORT.md`](./SECURITY-CVE-REPORT.md).

### Useful commands

```bash
pnpm audit            # production dependency advisories
pnpm audit:ci         # fails on high/critical (used in CI)
pnpm lint             # includes eslint-plugin-security
pnpm type-check       # strict TypeScript
```

---

_Qualtech Engineering — secure-by-default multitenant frontend baseline._
