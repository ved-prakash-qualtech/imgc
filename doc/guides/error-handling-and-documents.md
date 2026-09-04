# Error Handling & Quality Gates

This guide covers error boundary standards and quality gate requirements.

---

## 1. Error boundaries (MANDATORY)

A React render error with no boundary blanks the whole screen. Use the shared
`WidgetErrorBoundary` (`src/components/shared/WidgetErrorBoundary.tsx`) at two scopes.

### App-level (already wired)

The root layout wraps the tree in `WidgetErrorBoundary` with `variant="app"` — a full-page fallback with retry.

```tsx
import { WidgetErrorBoundary } from "@/components/shared";

<WidgetErrorBoundary variant="app">{children}</WidgetErrorBoundary>;
```

### Widget-level (use around every panel)

Default `variant="widget"` — inline fallback with optional `label`, `resetKeys`, and `className`:

```tsx
import { WidgetErrorBoundary } from "@/components/shared";

<WidgetErrorBoundary label="Examples panel">
  <ExamplesWidget tenantId={tenant.shortCode} />
</WidgetErrorBoundary>;
```

If one widget crashes, its siblings keep rendering.

### Async / event-handler errors

Boundaries only catch render errors. For handlers/promises:

```tsx
import { useErrorHandler } from "@/hooks/useErrorHandler";

const handleError = useErrorHandler();
const onSubmit = async () => {
  try {
    await saveData(payload);
  } catch (error) {
    handleError(error); // surfaces to the nearest boundary
  }
};
```

---

## 2. Quality gates & commits

- Pre-commit (Husky + lint-staged): type-check, ESLint `--max-warnings 0`, Prettier.
- Commits follow **Conventional Commits** with a product scope:

  ```text
  feat(kyc): add tenant document upload
  fix(auth): correct token refresh on 401
  ```

- Run before push: `pnpm lint && pnpm format:check && pnpm test:unit`

---

## 3. Security headers

Configured in `next.config.ts`: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, and `poweredByHeader: false`.

**Never weaken security headers or CSP** without explicit approval.
