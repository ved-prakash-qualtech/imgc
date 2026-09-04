# Environments

Environment variable reference for the **Next.js Multitenant Template**. All values are validated at startup via Zod.

## Validation pipeline

```
process.env
    → buildEnvRawFromProcessEnv()     (src/lib/utils/env/env.ts)
    → envRawSchema                    (src/lib/resolver/envSchema.ts)
    → envSchema (coerce + transform)
    → export const env                (typed, fail-fast)
```

Invalid values throw at module load with a descriptive Zod message.

> **Never** read `process.env` directly in app code — always import the validated singleton from `@/lib/utils/env`.

## Application variables

| Variable                  | Default           | Description                                 |
| ------------------------- | ----------------- | ------------------------------------------- |
| `NODE_ENV`                | `development`     | `development` \| `production` \| `test`     |
| `NEXT_PUBLIC_APP_ENV`     | `local`           | `local` \| `uat` \| `prod` \| `development` |
| `NEXT_PUBLIC_APP_NAME`    | `Multitenant App` | Application display name                    |
| `NEXT_PUBLIC_APP_VERSION` | `0.1.0`           | Display version                             |

## Backend / multitenancy variables (server-only)

| Variable            | Required       | Description                                  |
| ------------------- | -------------- | -------------------------------------------- |
| `SUPER_ADMIN_URL`   | Yes            | Super-admin backend URL (tenant registry)    |
| `BACKEND_BASE_URL`  | Yes (fallback) | Tenant backend base URL                      |
| `API_CLIENT_ID`     | Yes (prod)     | Client ID for super-admin authentication     |
| `API_CLIENT_SECRET` | Yes (prod)     | Client secret for super-admin authentication |

## Encryption (server-only)

| Variable                | Required   | Description                                  |
| ----------------------- | ---------- | -------------------------------------------- |
| `ENCRYPTION_MASTER_KEY` | Yes (prod) | 64 hex chars (32 bytes) — AES-256 master key |

#### Generating the key

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','').ToLower()

# OpenSSL
openssl rand -hex 32
```

**Rotate this key** whenever you suspect exposure. Rotating invalidates all previously encrypted values.

## Vault integration (server-only)

| Variable            | Description              |
| ------------------- | ------------------------ |
| `VAULT_ADDR`        | Vault server address     |
| `VAULT_TOKEN`       | Vault access token       |
| `VAULT_SECRET_PATH` | Path to secrets in Vault |

When Vault is configured, `getServerEnv()` reads secrets from Vault with a 5-minute cache. Falls back to `process.env` when Vault is not configured.

## Playwright

| Variable              | Default                 | Purpose                           |
| --------------------- | ----------------------- | --------------------------------- |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | E2E base URL                      |
| `CI`                  | —                       | Stricter Playwright + CI behavior |

## Environment files

| File         | Usage      |
| ------------ | ---------- |
| `.env.local` | Local dev  |
| `.env.prod`  | Production |
| `.env.uat`   | UAT        |

All `.env*` files are gitignored. See `.env.example` for the full template.

## Local setup example

```env
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_APP_NAME=Multitenant App
NEXT_PUBLIC_APP_VERSION=0.1.0
SUPER_ADMIN_URL=http://localhost:3000
BACKEND_BASE_URL=http://localhost:3000
ENCRYPTION_MASTER_KEY=<64-hex-chars>
```

## Using env in code

```typescript
import { env } from "@/lib/utils/env";
import { appConfig } from "@/constants/config";
```

Do not read `process.env` directly in application code — use `env` or constants re-exports.

## Adding a new variable

1. Extend `envRawSchema` and `envSchema` in `src/lib/resolver/envSchema.ts`.
2. Update `Env` in `src/types/env.ts`.
3. Read in `buildEnvRawFromProcessEnv()`.
4. Add fallback in `src/constants/envDefaults.ts` if needed.
5. Update `src/lib/serverEnv.ts` for server-only variables.
6. Document here and in `.env.example`.

## Related

- [Core — constants and config](../core/constants-and-config.md)
- [Deployment](./README.md)
