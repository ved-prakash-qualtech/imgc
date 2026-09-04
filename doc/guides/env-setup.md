# Environment Variables Setup

All environment variables are validated at boot time via **Zod** in
`src/lib/resolver/envSchema.ts`. The app will refuse to start if a required
variable is missing or malformed.

> **Never** read `process.env` directly in app code — always import the
> validated singleton from `@/lib/utils/env`. For server-only secrets use
> `getServerEnv()` from `@/lib/serverEnv`.

---

## Quick start

1. Copy `.env.example` to `.env.local` at the project root.
2. Fill in the `<placeholder>` values for your environment.
3. Run `pnpm dev`.

```dotenv
# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_APP_NAME=Multitenant App
NEXT_PUBLIC_APP_VERSION=0.1.0

# ── Backend (server-only) ─────────────────────────────────────────────────────
SUPER_ADMIN_URL=http://localhost:3000
BACKEND_BASE_URL=http://localhost:3000

# ── API client credentials (server-only) ──────────────────────────────────────
API_CLIENT_ID=<your-client-id>
API_CLIENT_SECRET=<your-client-secret>

# ── Encryption (server-only) ─────────────────────────────────────────────────
ENCRYPTION_MASTER_KEY=<generate — see section below>

# ── Vault (optional — leave blank to use process.env) ─────────────────────────
VAULT_ADDR=
VAULT_TOKEN=
VAULT_SECRET_PATH=
```

---

## Variable reference

### App (public)

| Variable                  | Required | Default           | Description                                             |
| ------------------------- | -------- | ----------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`     | Yes      | `local`           | Runtime tier — `local`, `development`, `uat`, or `prod` |
| `NEXT_PUBLIC_APP_NAME`    | Yes      | `Multitenant App` | Display name used in UI and logging                     |
| `NEXT_PUBLIC_APP_VERSION` | Yes      | `0.1.0`           | Semver version string                                   |

### Backend / multitenancy (server-only)

| Variable            | Required   | Description                                      |
| ------------------- | ---------- | ------------------------------------------------ |
| `SUPER_ADMIN_URL`   | Yes        | Super-admin backend URL for tenant registry      |
| `BACKEND_BASE_URL`  | Yes        | Tenant backend base URL (fallback)               |
| `API_CLIENT_ID`     | Yes (prod) | Client ID for super-admin API authentication     |
| `API_CLIENT_SECRET` | Yes (prod) | Client secret for super-admin API authentication |

### Encryption (server-only)

| Variable                | Required   | Description                                                 |
| ----------------------- | ---------- | ----------------------------------------------------------- |
| `ENCRYPTION_MASTER_KEY` | Yes (prod) | 64 hex chars — AES-256 master key for per-tenant encryption |

#### Generating the master key

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','').ToLower()

# OpenSSL
openssl rand -hex 32
```

**Rotate this key** whenever you suspect exposure. Rotating invalidates all previously encrypted values — re-encrypt any stored ciphertext before deploying the new key.

### Vault (optional)

| Variable            | Description              |
| ------------------- | ------------------------ |
| `VAULT_ADDR`        | Vault server address     |
| `VAULT_TOKEN`       | Vault access token       |
| `VAULT_SECRET_PATH` | Path to secrets in Vault |

When Vault is configured, `getServerEnv()` reads secrets from Vault with a 5-minute cache, falling back to `process.env`. The merged result is validated with Zod (`serverEnvSchema`) before use.

### Build / observability (optional)

| Variable                                              | Required | Default                       | Description                    |
| ----------------------------------------------------- | -------- | ----------------------------- | ------------------------------ |
| `ANALYZE`                                             | No       | `false`                       | Enable `@next/bundle-analyzer` |
| `NEXT_SOURCE_MAPS_ENABLED`                            | No       | `true` (dev) / `false` (prod) | Browser/server source maps     |
| `NEXT_PUBLIC_SENTRY_DSN`                              | No       | _(empty)_                     | Enables Sentry when set        |
| `SENTRY_DSN`                                          | No       | falls back to public DSN      | Server/edge DSN                |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | No       | —                             | Source map upload (CI)         |
| `SENTRY_TRACES_SAMPLE_RATE`                           | No       | `1` (dev) / `0.1` (prod)      | Trace sampling                 |
| `SENTRY_DEBUG`                                        | No       | `false`                       | Sentry SDK debug logging       |
| `CI`                                                  | No       | `false`                       | Detected in GitLab CI          |

Sentry is **optional**: with no DSN, `env.isSentryEnabled` is false and the Next config skips `withSentryConfig`.

---

## Per-environment files

Next.js loads env files in this priority order (highest first):

```
.env.local          ← local overrides, never committed
.env.development    ← dev-tier defaults  (committed, no secrets)
.env.production     ← prod-tier defaults (committed, no secrets)
.env                ← shared fallbacks   (committed, no secrets)
```

Put **secrets** only in `.env.local` or CI secret stores — never in committed files. The `.gitignore` excludes all `.env*` files (except `.env.example`).

---

## CI / CD

Store secrets as **masked CI variables** (GitLab) or **repository secrets** (GitHub Actions):

```
ENCRYPTION_MASTER_KEY
API_CLIENT_ID
API_CLIENT_SECRET
SUPER_ADMIN_URL
BACKEND_BASE_URL
```

---

## Validation internals

| Layer               | File                                             |
| ------------------- | ------------------------------------------------ |
| Raw shape           | `src/lib/resolver/envSchema.ts` — `envRawSchema` |
| Coerced & typed     | `src/lib/resolver/envSchema.ts` — `envSchema`    |
| Singleton           | `src/lib/utils/env/env.ts` — `env`               |
| Server-only secrets | `src/lib/serverEnv.ts` — `getServerEnv()`        |
| ServerEnv Zod       | `src/lib/resolver/serverEnvSchema.ts`            |
| Type definition     | `src/types/env.ts` — `Env`                       |
