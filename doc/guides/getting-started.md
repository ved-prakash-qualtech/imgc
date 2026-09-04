# Getting started

## Prerequisites

| Requirement | Version   |
| ----------- | --------- |
| Node.js     | ≥ 24.17.0 |
| pnpm        | ≥ 11.8.0  |

Install pnpm if needed:

```bash
corepack enable
corepack prepare pnpm@11.8.0 --activate
```

## Install dependencies

From the repository root:

```bash
pnpm install
```

## Environment setup

Create a `.env.local` file at the project root. See `.env.example` for all supported keys.

Minimal example for local development:

```env
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_APP_NAME=Multitenant App
NEXT_PUBLIC_APP_VERSION=0.1.0
SUPER_ADMIN_URL=http://localhost:8080
BACKEND_BASE_URL=http://localhost:8080
ENCRYPTION_MASTER_KEY=<64-hex-char-key>
```

Generate an encryption master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local testing with Host header

Since localhost doesn't support subdomains, test multitenancy with the Host header:

```bash
curl -H "Host: qc-app-local.qualtechedge.in" http://localhost:3000/examples
curl -H "Host: client1-app-local.qualtechedge.in" http://localhost:3000/examples
```

## Available scripts

| Script          | Command                | Description                      |
| --------------- | ---------------------- | -------------------------------- |
| Dev             | `pnpm dev`             | Start dev server                 |
| Build           | `pnpm build`           | Production build                 |
| Build analyze   | `pnpm build:analyze`   | Bundle analyzer build            |
| Start           | `pnpm start`           | Serve production build           |
| Lint            | `pnpm lint`            | Run ESLint                       |
| Lint fix        | `pnpm lint:fix`        | ESLint with auto-fix             |
| Stylelint       | `pnpm stylelint`       | Lint CSS in `src/`               |
| Format          | `pnpm format`          | Prettier write                   |
| Format check    | `pnpm format:check`    | Prettier check                   |
| Type check      | `pnpm type-check`      | `tsc --noEmit`                   |
| Audit           | `pnpm audit`           | Production dependency advisories |
| Audit CI        | `pnpm audit:ci`        | Fail on high/critical            |
| Test (watch)    | `pnpm test`            | Vitest in watch mode             |
| Unit tests      | `pnpm test:unit`       | Run unit tests once              |
| Storybook smoke | `pnpm test:storybook`  | Vitest Storybook browser project |
| Storybook       | `pnpm storybook`       | Start Storybook dev server       |
| Build Storybook | `pnpm build-storybook` | Build Storybook for production   |

## Git hooks

Husky runs on commit:

- **pre-commit:** lint-staged (ESLint, Prettier on staged files)
- **commit-msg:** commitlint (conventional commits)

## IDE setup

VS Code settings are in `.vscode/settings.json`. Launch configurations and tasks are available for debugging and common workflows.

## Next steps

- [Folder structure](./folder-structure.md) — where code lives
- [Multitenancy standards](../standards/nextjs-multitenant-template.md) — tenant resolution and encryption
