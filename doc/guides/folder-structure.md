# Folder structure

This document describes every major directory and file in the repository, what it contains, and how new code should be organized.

## Root directory

```
node-nextjs-multitenant-template/
├── .cursor/                # Cursor AI agent rules and skills (canonical)
├── .devin/                 # Devin AI agent rules and skills (mirror)
├── .husky/                 # Git hooks (pre-commit, commit-msg)
├── .vscode/                # Editor settings, launch configs, tasks
├── .windsurf/              # Windsurf AI agent rules and skills (mirror)
├── doc/                    # Project documentation
├── public/                 # Static files served at /
├── src/                    # Application source
├── test/                   # Automated tests (unit, integration, e2e)
├── .gitignore
├── .prettierignore
├── .prettierrc
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── commitlint.config.cjs
├── eslint.config.mjs
├── lint-staged.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest-env.d.ts
├── vitest.config.ts
└── vitest.shims.d.ts
```

---

## `src/` — Application source

The `@/` path alias resolves to `src/`.

### `src/app/` — Next.js App Router

Route segments map directly to URLs. Pages stay thin: they set `metadata` and render feature-level route views.

```
src/app/
├── layout.tsx              # Root layout with TenantProvider
├── global-error.tsx        # Global error UI
└── examples/
    └── page.tsx            # `/examples` — tenant-scoped example route
```

**Multitenancy:** Middleware (`src/middleware.ts`) resolves tenant from Host subdomain. System-scope routes (`/`, `/admin`) are excluded from tenant resolution.

### `src/components/` — Shared UI

Reusable components not tied to a single feature.

```
src/components/
├── providers/              # TenantProvider, other context providers
└── ui/                     # shadcn/ui primitives (button, input, dialog, …)
```

### `src/constants/` — Static configuration

| File             | Purpose                              |
| ---------------- | ------------------------------------ |
| `api.ts`         | API endpoint paths                   |
| `authCookies.ts` | Cookie names for auth tokens         |
| `config.ts`      | App name, version, environment flags |
| `routes.ts`      | Typed route path constants           |

### `src/features/` — Domain modules

Each feature is self-contained with its own components, API layer, and validators.

```
src/features/
└── <feature>/
    ├── components/         # Feature-specific UI
    ├── api/                # Fetchers, mutations
    ├── hooks/              # Domain hooks
    └── validator/          # Zod schemas
```

### `src/hooks/` — Shared React hooks

| Hook                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `useErrorHandler`   | Propagate async errors to error boundaries |
| `useLocalStorage`   | Typed localStorage access                  |
| `useSessionStorage` | Typed sessionStorage access                |
| `useFormInputRegex` | Input validation helpers                   |

### `src/lib/` — Infrastructure and utilities

```
src/lib/
├── aes.ts                 # AES-256-CBC encryption utilities
├── error/                 # Error boundary components and handlers
├── logging/               # Logging utilities (no Sentry)
├── serverEnv.ts           # Server-side env with Vault integration
├── server/                # Server-only modules
│   └── standInRegistry.ts # Stand-in tenant registry for local dev
├── services/
│   └── api/
│       ├── ssrApi.ts      # SSR API client with tenant headers
│       └── tenantResolver.ts # Tenant resolution from super-admin
├── storage/               # localStorage/sessionStorage utilities
├── storybook/             # Storybook helpers
├── tenant.ts              # Tenant context helpers
├── tenantEncryption.ts    # Per-tenant encryption APIs
├── tenantTheme.ts         # Per-tenant theming (brand tokens)
├── theme/                 # Theme helpers
└── utils/
    ├── env/               # Env parsing singleton
    ├── formatCurrency.ts
    ├── formatNumber.ts
    ├── formFieldId.ts
    ├── formInputSanitize.ts
    └── twMergeUtils.ts
```

### `src/middleware.ts` — Tenant resolution

Middleware extracts tenant from Host subdomain (`{tenant}-{product}-{env}.domain`) and sets the `x-tenant` header. Routes without a valid tenant return 403 (QT-TEN-403).

### `src/styles/` — Global styles

```
src/styles/
└── globals.css             # Tailwind imports, base styles
```

### `src/types/` — Shared TypeScript types

| File             | Purpose                       |
| ---------------- | ----------------------------- |
| `api.ts`         | API response envelope types   |
| `auth.ts`        | Auth-related types            |
| `dataTable.ts`   | Data table column/state types |
| `env.ts`         | Env interface                 |
| `forms.ts`       | Form field types              |
| `global.ts`      | Global augmentations          |
| `logging.ts`     | Logging types                 |
| `roles.ts`       | Role types                    |
| `routeAccess.ts` | Route access types            |

---

## `test/` — Automated tests

```
test/
├── e2e/                    # Playwright end-to-end specs
├── integration/            # Vitest integration tests
└── unit/                   # Vitest unit tests
```

---

## `public/` — Static assets

SVG icons and other files served at the site root.

---

## Configuration files (reference)

| File                           | Tool                                           |
| ------------------------------ | ---------------------------------------------- |
| `eslint.config.mjs`            | ESLint (Next.js, a11y, security, React perf)   |
| `prettier` / `.prettierignore` | Code formatting                                |
| `tailwind.config.ts`           | Tailwind CSS 4                                 |
| `postcss.config.mjs`           | PostCSS pipeline                               |
| `vitest.config.ts`             | Vitest (jsdom + Storybook browser, `@/` alias) |
| `commitlint.config.cjs`        | Conventional commit messages                   |
| `lint-staged.config.mjs`       | Pre-commit staged file checks                  |

---

## Where to put new code

| You are adding…            | Put it in…                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| A new page/route           | `src/app/<route>/page.tsx` + `src/features/<feature>/components/*RouteView.tsx` |
| Feature-specific logic     | `src/features/<feature>/`                                                       |
| Reusable UI                | `src/components/` (ui, providers, etc.)                                         |
| API client or fetch helper | `src/services/api/` or `src/features/<feature>/api/`                            |
| Shared hook                | `src/hooks/`                                                                    |
| Global constant            | `src/constants/`                                                                |
| Shared type                | `src/types/`                                                                    |
| Unit test                  | `test/unit/` (mirror source path)                                               |
| Storybook smoke            | `src/stories/` + `pnpm test:storybook`                                          |
