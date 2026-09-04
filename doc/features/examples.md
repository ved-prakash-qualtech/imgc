# Examples feature

**Path:** `src/features/examples/` (or `src/app/examples/`)  
**Route:** `/examples`

This feature is the reference implementation for tenant-scoped data fetching.

## How it works

1. Request arrives at `/examples`
2. Middleware resolves tenant from Host subdomain
3. `ssrApi` fetches data from `/api/v1/examples` with tenant context
4. Different tenants see different data + different brand colors

## Stand-in data

The template includes a stand-in route handler at `/api/v1/examples` that returns different mock data per tenant. Replace with a real backend call when connecting to QCP backends.

## Local testing

```bash
curl -H "Host: qc-app-local.qualtechedge.in" http://localhost:3000/examples
curl -H "Host: client1-app-local.qualtechedge.in" http://localhost:3000/examples
```

## Page wiring

```tsx
// src/app/examples/page.tsx
export const dynamic = "force-dynamic"; // tenant-scoped pages are always dynamic

export default async function ExamplesPage() {
  const tenant = await currentTenant();
  // fetch tenant data, render route view
}
```

## Related

- [API](../api/README.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
