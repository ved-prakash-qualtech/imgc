# Examples

Common patterns for the **Next.js Multitenant Template**.

## New tenant-scoped route

1. Add `ROUTES.myRoute` in `src/constants/routes.ts`
2. Create `src/features/myFeature/components/MyRouteView.tsx`
3. Create `src/app/my-route/page.tsx`:

```tsx
import type { Metadata } from "next";
import { currentTenant } from "@/lib/tenant";
import { MyRouteView } from "@/features/myFeature/components/MyRouteView";

export const dynamic = "force-dynamic"; // tenant-scoped pages are always dynamic

export const metadata: Metadata = { title: "My Route" };

export default async function MyRoutePage() {
  const tenant = await currentTenant();
  return <MyRouteView tenant={tenant} />;
}
```

## Fetching tenant-scoped data (server-side)

```typescript
import { ssrApi } from "@/services/api/ssrApi";

const api = ssrApi({ mode: "customer" });
const { data } = await api.get("/api/v1/my-resource");
```

`ssrApi` automatically forwards tenant context (Host + x-tenant headers).

## Per-tenant encryption

```typescript
import "server-only";
import { encryptForTenant, decryptForTenant } from "@/lib/tenantEncryption";

const encrypted = await encryptForTenant("sensitive data");
const decrypted = await decryptForTenant(encrypted);
```

## Local testing with different tenants

```bash
# Tenant: qc
curl -H "Host: qc-app-local.qualtechedge.in" http://localhost:3000/examples

# Tenant: client1
curl -H "Host: client1-app-local.qualtechedge.in" http://localhost:3000/examples

# No tenant — should 403
curl http://localhost:3000/examples
```

## Form with validation

See [Components — forms](../components/forms.md).

## Related

- [Architecture](../architecture/README.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
