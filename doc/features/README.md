# Features

Domain modules in `src/features/`.

## Module structure

```
src/features/<name>/
├── components/       # UI + *RouteView
├── api/              # fetchers, mutations (optional)
├── hooks/            # domain hooks (optional)
└── validator/        # Zod schemas (optional)
```

## Adding a feature

1. Create `src/features/<name>/` with subfolders above.
2. Add routes to `src/constants/routes.ts`.
3. Create `src/app/<path>/page.tsx` rendering `*RouteView`.
4. Add API endpoints to `src/constants/api.ts` if needed.
5. Add types to `src/types/` and tests under `test/`.

## Multitenancy in features

- Feature API calls go through `ssrApi` which automatically forwards tenant context.
- Feature components access current tenant via `currentTenant()` (server) or `useTenant()` (client).
- Feature-specific encryption uses `encryptForTenant` / `decryptForTenant` from `@/lib/tenantEncryption`.
