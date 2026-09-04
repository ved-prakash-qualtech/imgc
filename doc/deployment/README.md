# Deployment

Build, run, and deploy the **Next.js Multitenant Template**.

## Host deployment

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Port **3000** · `output: "standalone"`.

## Next.js build config (`next.config.ts`)

| Option          | Value          | Purpose                   |
| --------------- | -------------- | ------------------------- |
| `output`        | `"standalone"` | Minimal production bundle |
| `reactCompiler` | `true`         | Enable React Compiler     |

### TypeScript paths

`tsconfig.json`: `"paths": { "@/*": ["./src/*"] }` — mirrored in Vitest and Playwright configs.

## Environment tiers

| Tier       | `NEXT_PUBLIC_APP_ENV` | Env file     |
| ---------- | --------------------- | ------------ |
| Local      | `local`               | `.env.local` |
| UAT        | `uat`                 | `.env.uat`   |
| Production | `prod`                | `.env.prod`  |

→ Full variable list: [environments.md](./environments.md)

## Pre-production checklist

- [ ] `.env.prod` defines all required values
- [ ] `SUPER_ADMIN_URL` and `BACKEND_BASE_URL` point to real backends
- [ ] Stand-in route handlers removed
- [ ] `ENCRYPTION_MASTER_KEY` set (64 hex chars, from Vault)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test:unit` and `pnpm test:storybook` pass

## Troubleshooting

| Issue                   | Fix                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Port 3000 in use        | Change `PORT` env var                                                                 |
| Tenant 403 on localhost | Use Host header: `curl -H "Host: qc-app-local.qualtechedge.in" http://localhost:3000` |
| Env validation error    | See [environments.md](./environments.md)                                              |

## Related

- [Environments](./environments.md)
- [Testing](../testing/README.md)
