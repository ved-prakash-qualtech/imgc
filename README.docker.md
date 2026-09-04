# Docker: development and production

This project runs Next.js in containers using **Docker Compose**. Development uses a bind-mounted workspace and a persistent `node_modules` volume for fast reload. Production uses a **multi-stage image** and Next.js **`output: "standalone"`** so the runtime image only contains the built app and static assets.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2) with the daemon running.
- Root environment files as needed (see below). `.env*` files are gitignored; create them locally from your team’s secrets policy.

## Environment files

| File         | Typical use                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.local` | **Dev container**: loaded by Compose via `env_file`. Next.js also loads `.env.local` when you run `next dev` locally.                                                                                                 |
| `.env.prod`  | **Production**: runtime `env_file` in `docker-compose.prod.yml`. If present during **image build**, it is copied to `.env.production` when `APP_ENV=prod` so `NEXT_PUBLIC_*` values are baked into the client bundle. |
| `.env.uat`   | **UAT image build**: pass `--build-arg APP_ENV=uat` so the Dockerfile copies `.env.uat` to `.env.production` before `pnpm build`.                                                                                     |

`.env.prod` and `.env.uat` are **not** special file names for `next dev` on the host; they matter for Docker build/runtime as described above.

## Development container (hot reload)

The dev stack mounts the repository into `/app` and uses a named volume for `/app/node_modules` so your host directory does not replace dependencies installed in the container. File watching uses polling flags that help **Docker Desktop on Windows** pick up saves reliably.

1. Ensure `.env.local` exists (Compose references it). You can start from the placeholders in the repo if your copy already has one.
2. From the **repository root** (auto-opens your host browser when the app is ready):

   ```bash
   pnpm docker:dev
   ```

   Or without auto-open:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

   Then open [http://localhost:3000](http://localhost:3000) manually.

**First run:** The container may run `pnpm install --frozen-lockfile` once if `node_modules` in the volume is empty, then starts `pnpm dev:no-open` (Next.js dev server). Browser auto-launch runs on the **host** via `pnpm docker:dev`, not inside the container.

**Stop:** `Ctrl+C` in the terminal, or `docker compose -f docker-compose.dev.yml down`.

**Optional:** `docker compose -f docker-compose.dev.yml down -v` removes the named volume and forces a full dependency reinstall on the next `up`.

## Production build and run

The production Dockerfile installs dependencies, optionally copies `.env.${APP_ENV}` to `.env.production`, runs `pnpm build`, then copies the **standalone** server bundle and `.next/static` into a small final stage. The process listens on port **3000** inside the container.

1. Ensure `.env.prod` exists if you rely on build-time or documented runtime variables.
2. From the **repository root**:

   ```bash
   docker compose -f docker-compose.prod.yml up --build
   ```

3. Open [http://localhost:3000](http://localhost:3000).

**Build only (no run):**

```bash
docker compose -f docker-compose.prod.yml build
```

### UAT image (same Compose file, different build arg)

To bake **UAT** `NEXT_PUBLIC_*` (and other keys in `.env.uat`) into the production build, build with `APP_ENV=uat` so the Dockerfile copies `.env.uat` before `next build`:

```bash
docker compose -f docker-compose.prod.yml build --build-arg APP_ENV=uat
docker compose -f docker-compose.prod.yml up
```

For runtime environment in UAT, point `env_file` at `.env.uat` in a local override file or adjust the compose service for your deployment pipeline (the default file uses `.env.prod`).

## Layout reference

| Path                      | Role                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `docker/Dockerfile.dev`   | Dev image: Node 24.17.0, pnpm 11.8.0, `pnpm dev`.                   |
| `Dockerfile`              | Prod multi-stage build and standalone runner.                       |
| `docker-compose.dev.yml`  | Dev service, volumes, polling env.                                  |
| `docker-compose.prod.yml` | Prod build args and runtime `env_file`.                             |
| `.dockerignore`           | Keeps build context small; excludes `.env.local` from prod context. |

## Troubleshooting

- **Cannot connect to Docker:** Start Docker Desktop (or the Docker service) and retry.
- **Port 3000 already in use:** Stop the other process or change the host port in the compose file (e.g. `"3001:3000"`).
- **Stale dependencies in dev:** Remove the volume with `docker compose -f docker-compose.dev.yml down -v`, then `up --build` again.
- **`instrumentation.ts` / `MODULE_UNPARSABLE` on Windows:** Turbopack writes under `.next/dev`; on Docker Desktop bind mounts that path is slow and can fail with “file not found” for `src/instrumentation.ts`. The dev compose file mounts a named volume at `/app/.next` so the cache stays on container storage. If it persists, run `docker compose -f docker-compose.dev.yml down -v` once, or use `pnpm dev:no-open -- --webpack` inside the container as a fallback.
