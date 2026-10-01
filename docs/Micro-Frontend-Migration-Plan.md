# Micro-Frontend Migration Plan — IMGC Lender Portal

|             |                                                                            |
| ----------- | -------------------------------------------------------------------------- |
| Status      | Proposal — not started                                                     |
| Approach    | Next.js **multi-zones** in a **pnpm monorepo**                             |
| Stack today | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · next-intl |
| Reference   | `node_modules/next/dist/docs/01-app/02-guides/multi-zones.md`              |

## 1. Why multi-zones (and not Module Federation)

The portal is server-rendered: pages are server components, writes go through server actions, and the
session, tenant and scope are resolved in `proxy.ts` and read on the server. Module Federation loads
client bundles at runtime and does not carry server components or server actions across applications.
Multi-zones is the Next.js-supported micro-frontend model: each zone is a normal Next.js app that serves
a set of paths; a router sends each path to its zone, and the browser sees one site.

**Trade-off to accept:** moving between two zones is a full page load. Screens that are used together
must therefore live in the same zone.

## 2. Current state

One Next.js app. All screens are under `src/app/[locale]/(portal)/`:

| Area            | Routes                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Claims          | `accounts`, `initiate-claim` (Claim by IMGC), `claims`, `track-claim`, `claim-dashboard`, `track-query-response`     |
| Loans           | `dashboard`, `dpd` (All Loans), `buckets`                                                                            |
| Admin & support | `admin/*` (Lender Access, Retention, Document Configuration), `additional-documents`, `audit-trail`, `notifications` |
| Entry           | `login`, shell, sidebar, session                                                                                     |

Shared by everything: `src/components/*`, `src/lib/auth/*`, `src/proxy.ts`, `src/services/portal/*`,
`src/server/mock/*` (in-process data), `src/translations/*`, `src/constants/*`, `src/config/*`.

## 3. Target architecture

```
                    ┌────────────────────────────┐
   Browser ───────► │  shell zone (router)       │  login, shell, session, proxy.ts, rewrites
                    └──────┬───────┬───────┬─────┘
                           │       │       │
                  claims zone   loans zone   admin zone
                           │       │       │
                    ┌──────▼───────▼───────▼─────┐
                    │  backend API (QCP)         │  single source of data
                    └────────────────────────────┘
```

### Zones

| Zone       | Paths                                                                                                  | Notes                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **shell**  | `/`, `/login`, `/api/auth/*`, `/forbidden`, routing                                                    | Owns the proxy (tenant + scope), the sidebar menu call, and rewrites. |
| **claims** | `/accounts`, `/initiate-claim`, `/claims`, `/track-claim`, `/claim-dashboard`, `/track-query-response` | Tightly coupled screens — keep together.                              |
| **loans**  | `/dashboard`, `/dpd`, `/buckets`                                                                       | Portfolio views.                                                      |
| **admin**  | `/admin/*`, `/additional-documents`, `/audit-trail`, `/notifications`                                  | Least coupled — migrate first.                                        |

Final split should be confirmed against team ownership and release cadence (open question 3).

### Monorepo layout

```
apps/
  shell/   claims/   loans/   admin/
packages/
  ui/        components/ui, miFIN tokens + styles, sonner shim, StatusPill, Panel, shell parts
  auth/      lib/auth/*, tenant + scope helpers
  i18n/      translations (en, hi, records.en.json), recordMessages, serverErrorMessage
  data/      services/portal/*, API client (replaces server/mock/*)
  config/    constants, config/*, ROUTES, tsconfig + eslint base
```

## 4. Migration steps

### Step 1 — Monorepo, no behaviour change

- Convert to pnpm workspaces; move the current app to `apps/shell` unchanged.
- Extract `packages/*` one by one, rewriting `@/…` imports to package names.
- **Exit check:** `tsc`, eslint (`--max-warnings=0`), and the catalogue parity check pass; app behaves identically.

### Step 2 — Make shared state cross-zone safe

| Concern        | Change                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session        | All zones use the same signing secret and cookie domain; one sign-in works everywhere.                                                                       |
| Tenant / scope | Resolved once in the shell proxy; passed on as `x-tenant` and `x-app-scope`. Zones read, never re-derive (existing rule).                                    |
| Data           | Replace in-process `readDb`/`writeDb` with calls to the backend API through `ssrApi`. **This is the main blocker** — zones cannot share an in-process store. |
| Translations   | One `packages/i18n`; each zone ships only the namespaces it uses.                                                                                            |

### Step 3 — Create zone apps

- Each `apps/*` gets its own `next.config.ts` with a unique `assetPrefix` (e.g. `/claims-static`).
- Paths must be unique to a zone.
- Env per zone: `CLAIMS_ZONE_URL`, `LOANS_ZONE_URL`, `ADMIN_ZONE_URL` for the shell.

### Step 4 — Routing in the shell

`rewrites` in `apps/shell/next.config.ts`, for example:

```ts
{ source: "/accounts/:path+", destination: `${process.env.CLAIMS_ZONE_URL}/accounts/:path+` },
{ source: "/claims-static/:path+", destination: `${process.env.CLAIMS_ZONE_URL}/claims-static/:path+` },
```

Use `proxy.ts` instead where a feature flag must decide per request (gradual cut-over).

### Step 5 — Cross-zone navigation

- Links that leave a zone use a plain `<a>`; same-zone links keep `<Link>` (Link would prefetch and soft-navigate to a path another zone owns).
- `ROUTES` lives in `packages/config`, each route tagged with its zone.
- Sidebar keeps coming from `GET /api/v1/menus`, so menus work across zones unchanged.

### Step 6 — Move zones one at a time

1. **admin** — extract, run beside the old routes behind a flag, verify, switch the rewrite, delete the old copy.
2. **loans** — same.
3. **claims** — last; largest and most coupled.

### Step 7 — CI/CD

- Build and deploy per app with path filters and `pnpm --filter`.
- Shared lint, `tsc`, and catalogue-parity jobs run for every zone.
- Version `packages/*`; zones release at different times, so keep shared contracts backward compatible.

## 5. Code changes summary

| Change                                  | Where                                        |
| --------------------------------------- | -------------------------------------------- |
| Move folders, rewrite `@/…` imports     | whole repo                                   |
| Replace direct DB access with API calls | `src/services/portal/*`, `src/server/mock/*` |
| Add per-zone config, env, CI            | each `apps/*`                                |
| Cross-zone `<a>` links                  | components with `Link` to another zone       |
| Keep `sonner` tsconfig alias            | every zone using toasts                      |

**Unchanged:** screens, labels and message files, status identifiers, roles and scopes, theming,
multi-tenancy rules (tenant from Host only, deny by default).

## 6. Risks

| Risk                                    | Mitigation                                                          |
| --------------------------------------- | ------------------------------------------------------------------- |
| Hard navigation between zones           | Split by user flow; keep Claims, Claim by IMGC, and Track together. |
| In-process mock data cannot be shared   | Backend API first (Step 2) — gate for Steps 3–6.                    |
| Version drift in shared packages        | Versioned packages, backward-compatible changes, feature flags.     |
| Duplicate bundles / slower first load   | Shared packages, per-zone translation namespaces.                   |
| Session or tenant mismatch across zones | One secret and cookie domain; tenant resolved only in the shell.    |

## 7. Open questions

1. ~~One repository (monorepo) or a repository per zone?~~ **Decided: one repository (monorepo).**
2. Does the real backend API exist yet, or does it need to be built?
3. Which teams own which areas, and who needs independent deploys? (decides the zone split)
4. Is a single domain with path routing acceptable, or are separate subdomains required?

## 8. Suggested order

| Phase | Work                                    | Depends on      |
| ----- | --------------------------------------- | --------------- |
| A     | Monorepo + shared packages (Step 1)     | —               |
| B     | Backend API for data (Step 2)           | open question 2 |
| C     | Zone apps + routing (Steps 3–5)         | A, B            |
| D     | Migrate admin → loans → claims (Step 6) | C               |
| E     | CI/CD per zone (Step 7)                 | C               |

## 9. Status

| Step | What                                 | Status                                                                                                  |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1    | Monorepo, packages, no import cycles | **Done** — 12 packages, layering enforced in CI                                                         |
| 2    | Cross-zone safe shared state         | **Done for the prototype** — see "State shared between zones"                                           |
| 3    | Zone apps                            | **Done** — `apps/{shell,claims,loans,admin}`                                                            |
| 4    | Routing in the shell                 | **Done** — rewrites generated from `ZONE_PATHS`                                                         |
| 5    | Cross-zone navigation                | **Done** — `ZoneNavigationGuard`, redirects on the public origin                                        |
| 6    | Migrate zone by zone                 | **Done in one pass** — admin, loans, claims moved together, verified route by route                     |
| 7    | CI/CD per zone                       | **Done in config** — CI build matrix, one Dockerfile and compose service per app; pipelines not yet run |

### What the repository looks like now

```
apps/shell    :3000   sign-in, `/`, `/api/*`; rewrites every other path to its zone
apps/claims   :3001   accounts, initiate-claim, claims, track-claim, claim-dashboard, track-query-response
apps/loans    :3002   dashboard, dpd, buckets
apps/admin    :3003   admin/*, additional-documents, audit-trail, notifications
packages/     types · i18n · constants · config · utils · store · lib · hooks · ui · data · actions · features
tooling/      createNextConfig.ts (the one Next config) · loadRootEnv.ts
```

Package layers — a package may depend only on a lower one, and must declare it (`pnpm check:layers`):

```
types, i18n → constants, config → utils, store → lib → hooks → ui → data → actions → features → apps
```

### How a request travels

1. The browser talks only to the shell. `apps/shell/src/proxy.ts` runs locale routing and the session
   check **only for the shell's own paths**; every path a zone serves is excluded from its matcher.
   (If the shell ran next-intl first, `/accounts` would become `/en/accounts` before the rewrite to
   the claims zone is matched, and the shell would answer 404 for a path it does not own.)
2. `rewrites()` in the shell (generated from `ZONE_PATHS` in `packages/i18n/zones.ts`, for the bare and
   the `/hi` prefix, plus `/<zone>-static/*` for assets) sends the request to the zone's origin
   (`CLAIMS_ZONE_URL`, `LOANS_ZONE_URL`, `ADMIN_ZONE_URL`; localhost ports by default).
3. The zone runs the same shared proxy (`packages/lib/proxy.ts`): session check, locale routing. A
   redirect it issues is rebuilt on the address the browser used (`x-forwarded-host`), not the zone's
   internal one, so sign-in and locale redirects land back on the shell.
4. The zone renders with the shared root layout (`packages/features/layout/LocaleLayout.tsx`) and its
   assets are served under its own prefix so zones never collide.

### State shared between zones

- **Session**: one signed cookie, one `SESSION_SECRET`. Every zone verifies it with the same code.
- **Environment**: one `.env*` at the repository root, read by every app (`tooling/loadRootEnv.ts`).
- **Data**: every zone uses the same store. In disk mode that is the single `.data/` at the repository
  root (`packages/data/server/mock/paths.ts` anchors it there, not at each app's working directory);
  with `SNAPSHOT_STORE=postgres` it is the shared Neon database.
- **Known limit**: the prototype store rewrites a whole snapshot on each save, so two zones saving at
  almost the same moment can overwrite each other. Fine for a demo; the real backend API (open
  question 2) removes it.

### Day-to-day

- `pnpm dev` starts all four; `pnpm dev --zones=claims` starts the shell plus the zones you name.
- `pnpm build` builds all four; `pnpm --filter @imgc/app-claims build` builds one.
- New route: add the folder to the owning zone, add its prefix to `ZONE_PATHS` **and** to the matcher in
  `apps/shell/src/proxy.ts` (`test/unit/zones/zones.test.ts` fails if they disagree).
- New zone: add it to `ZONES`/`ZONE_PATHS`/`ZONE_DEV_PORT`, create `apps/<name>` from an existing zone,
  add it to `scripts/dev.mjs`, the Dockerfile's manifest copies, the compose file and the CI matrix.
- After adding a workspace package: `pnpm install` and restart `pnpm dev`.
- `packages/ui` has a generated `exports` map: `pnpm sync:exports` after adding or moving a file.

### Limits to know about

- **A link to another zone is a full page load** by design. `ZoneNavigationGuard` turns any click that
  would leave the zone into one. Programmatic `router.push` across zones must use
  `window.location.assign`; none exists today.
- **Development uses a front-door proxy, not the shell's rewrites.** Next's dev server does not forward
  WebSocket upgrades through a rewrite, so behind the shell the hot-reload socket never connected and
  zone pages rendered but never became interactive. `scripts/devFrontDoor.mjs` listens on :3000, routes by
  `ZONE_PATHS` and forwards upgrades; the shell listens on :3004. Production is unaffected (no HMR).
- **Dev start-up is sequential and warmed** (`scripts/dev.mjs`) because four cold Turbopack servers can
  leave a zone with an empty route table (404 everywhere). Delete `apps/*/.next` if it still happens.
- **Cross-zone redirects go through `/api/zone-redirect`** (`redirectTo`), since a soft navigation into
  another zone never completes.
- **A zone's first request after start compiles its page** and can exceed 30 s; the shell's proxy
  timeout is raised to 300 s in `tooling/createNextConfig.ts` for that reason.
- **After a Turbopack crash a zone can answer 404 for every route.** Delete that app's `.next/` and
  restart.
- **Deployment**: each app is its own deployable. On Vercel that means one project per app with its
  Root Directory set to `apps/<name>` (the current `.vercel` link points at the repository root).
  Nothing was deployed as part of this work.
