# Next.js Multitenant Template Standards

This document defines the multitenancy-specific patterns and rules for the Next.js multitenant template.

## Tenant identity

**Tenant identity comes ONLY from the Host subdomain:**

```
{tenant}-{product}-{env}.domain
```

Examples:

- `qc-app-local.qualtechedge.in` → tenant: `qc`
- `client1-app-local.qualtechedge.in` → tenant: `client1`
- `admin-*` → superadmin/system scope (no tenant resolution)

### Resolution

1. **Middleware** (`src/middleware.ts`) extracts tenant from Host subdomain
2. Sets `x-tenant` header for downstream consumption
3. **Never** accept tenant from body, query params, or client-supplied headers (middleware strips inbound `x-tenant`)

### Server-side access

```typescript
import { currentTenant, getTenantOrNull } from "@/lib/tenant";

// In server components or API routes
const tenant = await currentTenant(); // Throws if no tenant
const tenant = await getTenantOrNull(); // Returns null if no tenant
```

### Client-side access

```typescript
import { useTenant } from "@/components/providers/TenantProvider";

// In client components
const tenant = useTenant();
```

**Never** re-derive tenant from `window.location` in client code.

## Deny by default

- No resolvable tenant on a tenant-scoped route → **403 QT-TEN-403** (locked envelope)
- System-scope routes (`/`, `/admin`, registry endpoints) are explicitly excluded in middleware

## Tenant context

- Server code reads `currentTenant()` / `getTenantOrNull()` from the middleware-set `x-tenant` header
- Client components use `useTenant()` from `<TenantProvider>` (root layout)
- The subdomain is the single source of truth end to end

## Registry resolution

Tenant resolution uses the super-admin backend registry:

1. Super-admin API client token (`X-Client-Id`/`X-Client-Secret`) → `GET /api/v1/tenants/active`
2. Match by `shortCode` → tenant backend URL built by swapping the `admin-` subdomain prefix
3. Module-level cache, 5-minute TTL
4. The backend registry is the authority — middleware's regex is shape-only

Implementation: `src/services/api/tenantResolver.ts`

## ssrApi forwarding

`ssrApi` forwards the original Host (`X-Forwarded-Host`) and `x-tenant` so the backend resolves the same tenant — the subdomain is the single source of truth end to end.

## Per-tenant theming

Per-tenant theming = **BRAND-token overrides only**:

- Implementation: `src/lib/tenantTheme.ts`
- Applied in the root layout as CSS custom properties
- Components keep using miFIN™ token names and **NEVER branch on tenant**
- Neutrals, semantic colors, spacing, radius and component styles are not tenant-overridable

## Per-tenant encryption

Server-only encryption APIs:

- `encryptForTenant(plaintext, tenantShortCode?)` — encrypt with tenant-specific key
- `decryptForTenant(ciphertext, tenantShortCode?)` — decrypt with tenant-specific key
- `encryptForUser(plaintext, userId)` — encrypt with user-specific key
- `decryptForUser(ciphertext, userId)` — decrypt with user-specific key

Implementation: `src/lib/tenantEncryption.ts`

Key derivation:

- Tenant key: HMAC-SHA256(masterKey, `tenant:{shortCode}`)
- User key: HMAC-SHA256(masterKey, `user:{userId}`)
- Master key from `ENCRYPTION_MASTER_KEY` env var (64 hex chars)

## Caching

Caching is tenant-keyed:

- Tenant-scoped pages are `force-dynamic`
- Any cache entry (including `resolveTenantDataSSR`'s) is keyed by tenant
- Never put tenant data in module-level state that isn't tenant-keyed

## Stand-ins

The following exist only so the template runs standalone:

- `src/server/standInRegistry.ts` — mock tenant registry
- `/api/v1/tenants/active` route handler — mock tenant list
- `/api/v1/api-clients/auth/token` route handler — mock token endpoint
- Tenant-scoped `/api/v1/examples` route handler — mock data

In a real product:

- Delete these stand-ins
- Set `SUPER_ADMIN_URL`/`BACKEND_BASE_URL` (or Vault)
- The same code talks to the real QCP backends

## Local testing

No subdomains on localhost — drive the tenant with the Host header:

```bash
curl -H "Host: qc-app-local.qualtechedge.in"      http://localhost:3000/examples
curl -H "Host: client1-app-local.qualtechedge.in" http://localhost:3000/examples
curl -H "Host: ghost-app-local.qualtechedge.in"   http://localhost:3000/examples  # 403 Invalid tenant
curl http://localhost:3000/examples                                               # 403 QT-TEN-403
```

## Related

- [Multi-Tenancy standards](./multi-tenancy.md) — QCP backend multi-tenancy patterns
- [Folder structure](../guides/folder-structure.md) — where tenant code lives
