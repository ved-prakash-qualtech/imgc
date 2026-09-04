# Constants and configuration

Reference for `src/constants/`.

## `routes.ts`

Application route paths. Always use these instead of hard-coded strings.

```typescript
ROUTES.examples; // "/examples"
```

Used in: navigation, redirects, links.

## `api.ts`

Backend API endpoint configuration.

| Export                   | Description        |
| ------------------------ | ------------------ |
| `API.ENDPOINTS.EXAMPLES` | `/api/v1/examples` |

## `config.ts`

| Export      | Description                         |
| ----------- | ----------------------------------- |
| `APP_NAME`  | Display name from env               |
| `appConfig` | Runtime flags: `isProduction`, etc. |

Used in layout metadata and conditional UI.

## `authCookies.ts`

Cookie key constants for access and refresh tokens. Keep in sync with auth store.

## `envDefaults.ts`

Fallback values when env vars are unset. Used only by env parsing — not for direct imports in feature code.

## Related

- [Deployment — environments](../deployment/environments.md)
- [Auth and state](./auth-and-state.md)
