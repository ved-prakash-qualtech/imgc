# Types and hooks

Shared TypeScript types and React hooks.

## Types (`src/types/`)

### API (`api.ts`)

```typescript
APIResponse<T>; // QCP locked envelope: { data: T, status, message }
```

### Auth (`auth.ts`)

Auth-related types for login credentials and session data.

### Forms (`forms.ts`)

Prop types for form field components.

### Data table (`dataTable.ts`)

Loading config, skeleton variants, column metadata extensions for TanStack Table.

### Environment (`env.ts`)

Validated `Env` interface with computed flags (`isProduction`, etc.).

### Roles (`roles.ts`)

User role types.

### Route access (`routeAccess.ts`)

Route access level types (`public` / `auth` / `tenant-scoped`).

### Logging (`logging.ts`)

Logging sink and level types.

## Hooks (`src/hooks/`)

### `useErrorHandler`

Propagates async/event errors to the nearest error boundary:

```typescript
import { useErrorHandler } from "@/hooks/useErrorHandler";

const handleError = useErrorHandler();
const onSubmit = async () => {
  try {
    await saveData(payload);
  } catch (error) {
    handleError(error);
  }
};
```

### `useFormInputRegex`

Regex-based validation for controlled inputs.

### `useLocalStorage` / `useSessionStorage`

Typed wrappers with JSON serialization. Use for non-auth, non-sensitive persistence.

> **Never** use these for auth tokens or PII — use httpOnly cookies.

## Adding types

1. Add to the appropriate file in `src/types/`.
2. Export from feature validators using `z.infer<typeof schema>` where possible.
3. Document new public types here if shared across features.

## Related

- [Components — forms](../components/forms.md)
- [Components — data table](../components/data-table.md)
