# API layer

HTTP client, endpoints, and SSR API integration.

## Configuration

`src/constants/api.ts`:

```typescript
export const API = {
  ENDPOINTS: {
    EXAMPLES: "/api/v1/examples",
  },
} as const;
```

## SSR API (`src/services/api/ssrApi.ts`)

Server-side API client that forwards tenant context:

```typescript
import { ssrApi } from "@/services/api/ssrApi";

const api = ssrApi({ mode: "admin" }); // or "customer" | "public"
const data = await api.get("/api/v1/examples");
```

`ssrApi` automatically forwards:

- `X-Forwarded-Host` — original Host header (tenant subdomain)
- `x-tenant` — resolved tenant short code

## Tenant resolver (`src/services/api/tenantResolver.ts`)

Resolves tenant data from the super-admin registry:

```typescript
import { resolveTenant } from "@/services/api/tenantResolver";

const tenant = await resolveTenant(shortCode);
// { shortCode, backendUrl, displayName, ... }
```

- Authenticates with super-admin using `X-Client-Id`/`X-Client-Secret`
- Caches results for 5 minutes (tenant-keyed)
- Tenant backend URL derived by swapping `admin-` prefix

## Stand-in route handlers (template only)

| Route                            | Purpose                 |
| -------------------------------- | ----------------------- |
| `/api/v1/tenants/active`         | Mock tenant registry    |
| `/api/v1/api-clients/auth/token` | Mock token endpoint     |
| `/api/v1/examples`               | Mock tenant-scoped data |

Delete these when connecting to real QCP backends.

## Adding an endpoint

1. Add to `API.ENDPOINTS` in `src/constants/api.ts`.
2. Create fetcher in `src/features/<feature>/api/` using `ssrApi`.
3. Add types in `src/types/`.

## Related

- [Core — constants and config](../core/constants-and-config.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
