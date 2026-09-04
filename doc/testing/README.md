# Testing

The project uses two test layers: **unit** and **Storybook smoke**.

## Overview

| Layer           | Runner                      | Location                              | Command               |
| --------------- | --------------------------- | ------------------------------------- | --------------------- |
| Unit            | Vitest                      | `test/unit/`                          | `pnpm test:unit`      |
| Storybook smoke | Vitest + Playwright browser | stories via `@storybook/addon-vitest` | `pnpm test:storybook` |

Watch mode for Vitest: `pnpm test`

## Vitest configuration

Config: `vitest.config.ts`

- **Projects:** (1) jsdom unit (2) storybook browser (Chromium)
- **Setup:** `src/lib/test/setup/vitest.setup.tsx`
- **Includes:** `test/unit/**/*.{test,spec}.{ts,tsx}`
- **Alias:** `@/` → `src/`
- **Pool:** forks

### Test utilities

`src/lib/test/utils/renderWithProviders.tsx` wraps components with next-intl + React Query.

## Unit tests

Mirror `src/components/` and `src/lib/` under `test/unit/`:

```
test/unit/
├── components/
│   ├── shared/Image.test.tsx
│   └── dataTable/DataTablePagination.test.tsx
├── lib/
│   └── tenantHost.test.ts
└── services/
    └── api/tenantResolver.test.ts
```

**Convention:** Place new unit tests in `test/unit/`, not co-located under `src/`.

## Storybook smoke

Requires Playwright Chromium once:

```bash
pnpm exec playwright install chromium
pnpm test:storybook
```
