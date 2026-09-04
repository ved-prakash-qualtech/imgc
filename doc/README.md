# Next.js Multitenant Template — Documentation

**Next.js Multitenant Template** is a QCP multitenant Next.js 16 application template (React 19, TypeScript, Tailwind CSS 4, pnpm).

## Documentation categories

| Folder                           | Contents                                                 |
| -------------------------------- | -------------------------------------------------------- |
| [guides/](./guides/)             | Getting started, folder structure, conventions, examples |
| [architecture/](./architecture/) | System design, App Router, layers, data flow             |
| [api/](./api/)                   | SSR API client, tenant resolver, endpoints               |
| [components/](./components/)     | Shared UI, forms, data tables                            |
| [core/](./core/)                 | Constants, types, hooks                                  |
| [features/](./features/)         | Auth, examples, and domain modules                       |
| [lib/](./lib/)                   | Infrastructure utilities                                 |
| [deployment/](./deployment/)     | Build, CI, environments, Next.js config                  |
| [testing/](./testing/)           | Vitest and Playwright                                    |
| [improvements/](./improvements/) | Roadmap and tech debt                                    |
| [standards/](./standards/)       | QCP engineering standards for multitenancy               |

## Quick start

1. [Getting started](./guides/getting-started.md)
2. [Folder structure](./guides/folder-structure.md)
3. [Architecture](./architecture/README.md)
4. [Multitenancy standards](./standards/nextjs-multitenant-template.md)

## Conventions

- `@/*` → `src/*`
- Feature modules under `src/features/<name>/`
- Thin pages in `src/app/`; UI in `*RouteView` components
- Validated env via Zod at startup
- Package manager: **pnpm**
- **Tenant identity from Host subdomain only** — never from body/query/headers

## External references

| File                         | Purpose                       |
| ---------------------------- | ----------------------------- |
| [../README.md](../README.md) | Repository README             |
| [../AGENTS.md](../AGENTS.md) | AI agent rules for Next.js 16 |
