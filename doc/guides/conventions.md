# Coding conventions

Rules and patterns for contributing to the **Next.js Multitenant Template**.

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- Prefer `type` over `interface` unless extending
- Use Zod `z.infer<typeof schema>` for form/API types
- Path alias: `@/` → `src/`

## File organization

| Rule           | Detail                                                  |
| -------------- | ------------------------------------------------------- |
| Thin routes    | `src/app/**/page.tsx` only metadata + `*RouteView`      |
| Feature-first  | Domain code in `src/features/<name>/`                   |
| Shared UI      | Reusable components in `src/components/`                |
| Env access     | Use `env` from `@/lib/utils/env`, not raw `process.env` |
| Feature hooks  | `src/features/<name>/hooks/` for domain-specific hooks  |
| Test mirroring | `test/unit/` mirrors `src/features/` and `src/lib/`     |

## Component size

- **Maximum 350 lines** per UI component module (`.tsx` files that export React UI)
- **Target ~200 lines**; split before hitting the cap
- Does **not** apply to: `page.tsx` route shells, hooks (`.ts`), validators, API modules, types, or tests

## Naming

| Item        | Convention   | Example                 |
| ----------- | ------------ | ----------------------- |
| Route views | `*RouteView` | `ExamplesRouteView`     |
| Hooks       | `use*`       | `useCreateLoanMutation` |
| Validators  | `*Schema`    | `createLoanInputSchema` |
| Test files  | `*.test.tsx` | `LoginForm.test.tsx`    |

## React

- Add `"use client"` only when using hooks, browser APIs, or event handlers
- Prefer composition over prop drilling; use Zustand sparingly for true global state
- Forms: React Hook Form + Zod resolver + shared `Form*` components
- Prefer **semantic HTML** (`button`, `img`, `dialog`, `nav`, etc.) over `<div role="…">` — see `.cursor/rules/semantic-html.mdc`

## Styling

- Tailwind utility classes
- Use `cn()` from `@/lib/utils/twMergeUtils` for conditional classes
- Theme tokens via CSS custom properties — avoid hard-coded hex in components

## Multitenancy

- **Tenant identity from Host subdomain only** — never from body, query params, or client-supplied headers
- Server code: use `currentTenant()` or `getTenantOrNull()` from `@/lib/tenant`
- Client components: use `useTenant()` from `<TenantProvider>`
- Per-tenant encryption: use `encryptForTenant` / `decryptForTenant` from `@/lib/tenantEncryption`
- Per-tenant theming: use brand token overrides only in `@/lib/tenantTheme`

## Commits

Conventional commits enforced by commitlint:

```
feat: add tenant export
fix: correct token refresh retry
docs: update api guide
test: add login page unit test
```

## Linting

- ESLint: Next.js, a11y, security, React perf plugins
- Prettier: formatting

Run before push: `pnpm lint && pnpm format:check && pnpm test:unit`

## Related

- [Folder structure](./folder-structure.md)
- [Multitenancy standards](../standards/nextjs-multitenant-template.md)
