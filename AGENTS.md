<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Agent Context — node-nextjs-multitenant-template

This is the **QCP multitenant Next.js application template** — `node-nextjs-template` plus the QCC Multi-Tenancy frontend layer (reference implementation: kyc-web-app). All base-template rules apply; follow the QCP standards in [`docs/standards/`](docs/standards/).

## Identity

- Multitenant variant of `node-nextjs-template` (frontend counterpart of `java-springboot-multitenant-template`)
- Stack: **Next.js 16 (App Router) · React 19 · TypeScript 5 strict · Tailwind CSS 4 · pnpm 11 (Node ≥24.17)**

## Base hard rules (unchanged — see the base template / docs/standards)

SSR pattern (page → Client → actions → `*.server.ts` → ssrApi) · secrets via `getServerEnv()` only · locked `APIResponse<T>` envelope · miFIN™ tokens only · RHF+Zod · Zustand for UI state · naming conventions · security headers · **next-intl** locales · optional **@sentry/nextjs**.

## Multitenancy hard rules (this template — see docs/standards/nextjs-multitenant-template.md + multi-tenancy.md)

1. **Tenant identity comes ONLY from the Host subdomain** `{tenant}-{product}-{env}.domain`, resolved in `src/proxy.ts` (composed with next-intl) — never from a body, query param or client-supplied header (proxy strips inbound `x-tenant`). `admin-*` = superadmin/system scope.
2. **Deny by default**: no resolvable tenant on a tenant-scoped route → `403 QT-TEN-403` (the locked envelope). System-scope routes (`/`, `/admin`, registry endpoints, `/monitoring`) are explicitly excluded. Locale prefixes (`/hi/...`) are stripped before the tenant path check.
3. **Tenant context**: server code reads `currentTenant()` / `getTenantOrNull()` (`src/lib/tenant.ts`, from the proxy-set `x-tenant` header); client components use `useTenant()` from `<TenantProvider>` — never re-derive from `window.location`.
4. **Registry resolution** (`src/services/api/tenantResolver.ts`, kyc-web-app pattern): super-admin API client token (`X-Client-Id`/`X-Client-Secret`) → `GET /api/v1/tenants/active` → match by `shortCode` → tenant backend URL built by swapping the `admin-` subdomain prefix. Module-level cache, 5-minute TTL. The backend registry is the authority — proxy Host regex is shape-only.
5. **`ssrApi` forwards the original Host (`X-Forwarded-Host`) and `x-tenant`** so the backend resolves the same tenant — the subdomain is the single source of truth end to end.
6. **Per-tenant theming = BRAND-token overrides only** (`src/lib/tenantTheme.ts` applied in the `[locale]` layout as CSS custom properties): components keep using miFIN™ token names and NEVER branch on tenant. Neutrals, semantic colors, spacing, radius and component styles are not tenant-overridable.
7. **Caching is tenant-keyed**: tenant-scoped pages are `force-dynamic`; any cache entry (including `resolveTenantDataSSR`'s) is keyed by tenant; never put tenant data in module-level state that isn't tenant-keyed.
8. **Stand-ins**: `src/server/standInRegistry.ts` + the `/api/v1/tenants/active`, `/api/v1/api-clients/auth/token` and tenant-scoped `/api/v1/examples` route handlers exist only so the template runs standalone. In a real product delete them, set `SUPER_ADMIN_URL`/`BACKEND_BASE_URL` (or Vault) and the same code talks to the real QCP backends.

## The signed-in shell

9. **Scope is a property of the host, not of the token.** The realm issues every account the same
   default roles, so a token cannot tell an administrator from a tenant's administrator. `proxy.ts`
   resolves it once (`resolveHostScope`) and passes it on as `x-app-scope`; server code reads it
   through `getSessionScope()`. Never re-derive it, and never treat it as an authorization
   decision — the backend decides that against the same token, where the signature is checked.
10. **The sidebar comes from the service.** `fetchSidebarMenus()` reads `GET /api/v1/menus`, which
    answers from the database the request belongs to. `src/constants/nav.ts` is the fallback for
    when the service cannot be reached — _not_ for when it answers with nothing. A service that
    returns no menus is granting nothing, and that answer is respected.
11. **Logout has to leave the app.** `/api/auth/logout` clears the cookies and then hands the
    browser to Keycloak's end-session endpoint; a client-side navigation would keep the browser
    inside the app and leave the realm session alive, which looks like sign-out did nothing.
12. **Development runs on https, on a real application hostname.** The session cookies are
    `Secure`, and a browser silently discards a `Secure` cookie delivered over http — sign-in then
    loops with nothing logged at either end. `scripts/dev.mjs` runs mkcert; set `DEV_HOSTNAME` so
    scope resolves, which `next.config.ts` also needs for `allowedDevOrigins` (without it Next
    blocks its own dev bundle and the page renders but never responds to a click).
13. **Toasts are ours.** `sonner` is not a dependency; `tsconfig` maps that specifier onto
    `src/lib/sonner.tsx`. Remove the alias and every `import { toast } from "sonner"` stops
    resolving.

## Local testing

No subdomains on localhost — drive the tenant with the Host header:

```bash
curl -H "Host: qc-app-local.qualtechedge.in"      http://localhost:3000/examples
curl -H "Host: client1-app-local.qualtechedge.in" http://localhost:3000/examples  # 403 until client1 is added to standInRegistry
curl -H "Host: ghost-app-local.qualtechedge.in"   http://localhost:3000/examples  # 403 Invalid tenant (registry)
curl http://localhost:3000/examples                                               # 403 QT-TEN-403 (no tenant)
curl -H "Host: qc-app-local.qualtechedge.in"      http://localhost:3000/hi/examples # Hindi locale + tenant
```

## Full standards

Everything in the base template's list plus `docs/standards/nextjs-multitenant-template.md` and `docs/standards/multi-tenancy.md` (the QCC standard, incl. the backend side).
