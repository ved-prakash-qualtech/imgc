# Improvements

Tracked enhancements, tech debt, and future work for the **Next.js Multitenant Template**.

## High priority

| Item                      | Area                                 | Notes                                                       |
| ------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Remove stand-in registry  | `src/server/standInRegistry.ts`      | Replace with real `SUPER_ADMIN_URL` + `BACKEND_BASE_URL`    |
| Wire real tenant backends | `src/services/api/tenantResolver.ts` | Set `API_CLIENT_ID`/`API_CLIENT_SECRET`, remove mock routes |

## Medium priority

| Item                        | Area                | Notes                                                 |
| --------------------------- | ------------------- | ----------------------------------------------------- |
| Integration / E2E suites    | `test/`             | Add real cross-module or Playwright specs when needed |
| CI build + test jobs        | `.gitlab-ci.yml`    | Extend beyond SAST/secret detection                   |
| Server Components for lists | `src/app/examples/` | Evaluate RSC prefetch for perf                        |

## Low priority / nice to have

| Item                | Area           | Notes                       |
| ------------------- | -------------- | --------------------------- |
| Storybook stories   | `src/stories/` | Component catalog           |
| Zod validation i18n | validators     | Localize Zod error messages |

## Completed

| Item                                                 | Notes                                   |
| ---------------------------------------------------- | --------------------------------------- |
| Yarn → pnpm migration                                | `pnpm@10.34.4`, node-modules linker     |
| Storybook setup                                      | `@storybook/nextjs` with Tailwind CSS 4 |
| Per-tenant encryption                                | AES-256-CBC, HMAC-SHA256 key derivation |
| `.cursor/` + `.devin/` + `.windsurf/` rules & skills | All three IDEs synced                   |
| `.vscode/` config                                    | launch.json, settings.json, tasks.json  |
| `doc/` documentation                                 | Full structure adapted for multitenant  |

## Contributing improvements

When completing an item:

1. Implement the change
2. Add/update tests
3. Update relevant doc in `doc/`
4. Remove or mark done in this file

## Related

- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
- [Architecture](../architecture/README.md)
