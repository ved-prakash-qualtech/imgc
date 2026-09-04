# Auth and state

Tenant context and client-side state.

## Tenant context (server-side)

**File:** `src/lib/tenant.ts`

```typescript
import { currentTenant, getTenantOrNull } from "@/lib/tenant";

// In server components or API routes
const tenant = await currentTenant(); // throws if no tenant
const tenant = await getTenantOrNull(); // returns null if no tenant
```

Reads the `x-tenant` header set by middleware. Never re-derive tenant from the URL.

## Tenant context (client-side)

```typescript
import { useTenant } from "@/components/providers/TenantProvider";

// In client components
const tenant = useTenant();
```

`TenantProvider` is wired in the root layout with tenant data resolved server-side.

## Cookie keys

**File:** `src/constants/authCookies.ts`

Names used when persisting tokens to cookies. Must stay consistent across login, refresh, and sign-out flows.

## Auth flow

1. User authenticates via the tenant's backend.
2. Tokens stored in httpOnly cookies (never localStorage).
3. SSR requests use server-side credentials via `ssrApi`.
4. Tenant resolved from Host subdomain for every request.

## Related

- [API](../api/README.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
