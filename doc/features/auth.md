# Auth feature

Authentication in the multitenant template.

## Auth flow

1. User authenticates via the tenant's backend API.
2. Tokens stored in httpOnly cookies (never localStorage).
3. All subsequent requests use server-side credentials via `ssrApi`.
4. Tenant is resolved from Host subdomain for every request.

## Tenant context

- Server: `currentTenant()` from `@/lib/tenant`
- Client: `useTenant()` from `TenantProvider`

## Cookie keys

**File:** `src/constants/authCookies.ts`

Names used when persisting tokens. Must stay consistent across login, refresh, and sign-out flows.

## Route guards

| Layer      | File                     | Purpose                               |
| ---------- | ------------------------ | ------------------------------------- |
| Middleware | `src/middleware.ts`      | Tenant resolution + deny by default   |
| Client     | Feature guard components | Secondary UI guard on protected pages |

Tenant-scoped routes: all routes under `/examples` and similar. System routes (`/`, `/admin`) are excluded.

## Related

- [Core — auth and state](../core/auth-and-state.md)
- [API](../api/README.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
