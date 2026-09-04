# Lib modules

Infrastructure in `src/lib/`.

## Directory map

```
src/lib/
├── aes.ts                 # AES-256-CBC encrypt/decrypt primitives
├── error/                 # ErrorBoundary, apiError, handle
├── logging/               # Logging utilities (no Sentry)
├── server/                # Server-only modules
│   └── standInRegistry.ts # Stand-in tenant registry (template only)
├── serverEnv.ts           # Server-only env with Vault integration
├── services/
│   └── api/
│       ├── ssrApi.ts      # SSR API client with tenant forwarding
│       └── tenantResolver.ts # Tenant resolution from super-admin
├── storage/               # Storage abstractions
├── storybook/             # Storybook helpers
├── tenant.ts              # Tenant context helpers
├── tenantEncryption.ts    # Per-tenant encryption APIs
├── tenantTheme.ts         # Per-tenant brand token overrides
├── theme/                 # Theme utilities
└── utils/
    ├── env/               # Validated env parsing
    ├── formatCurrency.ts
    ├── formatNumber.ts
    ├── formFieldId.ts
    ├── formInputSanitize.ts
    └── twMergeUtils.ts    # cn()
```

## Environment validation

```
process.env → buildEnvRawFromProcessEnv() → envRawSchema → envSchema → export const env
```

Schema: `src/lib/resolver/envSchema.ts`  
Invalid values throw at startup.

→ Variable reference: [../deployment/environments.md](../deployment/environments.md)

## Server-only secrets (`serverEnv.ts`)

```typescript
import { getServerEnv } from "@/lib/serverEnv";

const env = await getServerEnv();
// { encryptionMasterKey, apiClientId, apiClientSecret, ... }
```

Reads from Vault (5-minute cache) or `process.env`, then validates the
merged result with Zod (`src/lib/resolver/serverEnvSchema.ts`). Never
exposed to the client.

## Tenant context (`tenant.ts`)

```typescript
import { currentTenant, getTenantOrNull } from "@/lib/tenant";

const tenant = await currentTenant(); // throws if no x-tenant header
const tenant = await getTenantOrNull(); // returns null
```

## Tenant encryption (`tenantEncryption.ts`)

```typescript
import "server-only";
import { encryptForTenant, decryptForTenant } from "@/lib/tenantEncryption";

const ciphertext = await encryptForTenant("plaintext");
const plaintext = await decryptForTenant(ciphertext);
```

Key derivation: HMAC-SHA256(masterKey, `tenant:{shortCode}`).

## Error handling

| Module                            | Role                    |
| --------------------------------- | ----------------------- |
| `error/ErrorBoundary.tsx`         | React error boundary    |
| `error/ErrorBoundaryFallback.tsx` | Fallback UI             |
| `error/apiError.ts`               | Normalize API errors    |
| `error/handle.ts`                 | General error utilities |

## Logging

Logging utilities in `src/lib/logging/`. No Sentry dependency — configure remote sinks as needed.

## Import conventions

```typescript
import { env } from "@/lib/utils/env";
import { cn } from "@/lib/utils/twMergeUtils";
import { currentTenant } from "@/lib/tenant";
import { encryptForTenant } from "@/lib/tenantEncryption";
```

## Related

- [API](../api/README.md)
- [Deployment — environments](../deployment/environments.md)
- [Testing](../testing/README.md)
