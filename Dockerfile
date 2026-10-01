# Production image. At the repository root on purpose: the QShip deploy wrapper takes a
# Dockerfile *name*, not a path — "refused: dockerfile must be a file name, not a path" — so a
# build file under docker/ cannot be deployed at all. The dev image stays in docker/, where only
# docker-compose.dev.yml looks for it.
# Production: multi-stage build with Next.js standalone output.
#
# One image per app: the portal is a monorepo of four Next.js apps (shell, claims, loans, admin)
# served together under one domain. Pick the app with --build-arg APP=<name>; the default is the
# shell. The shell routes every other path to the zone that serves it (CLAIMS_ZONE_URL,
# LOANS_ZONE_URL, ADMIN_ZONE_URL), and each zone image runs on its own PORT.
FROM node:24.17.0-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

FROM base AS deps
# Every workspace manifest has to be present for a frozen-lockfile install to resolve.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/shell/package.json ./apps/shell/package.json
COPY apps/claims/package.json ./apps/claims/package.json
COPY apps/loans/package.json ./apps/loans/package.json
COPY apps/admin/package.json ./apps/admin/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
# shell | claims | loans | admin
ARG APP=shell
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prod | uat — copies matching root env file into .env.production for next build (when file exists).
ARG APP_ENV=prod
RUN if [ -f ".env.${APP_ENV}" ]; then cp ".env.${APP_ENV}" .env.production; fi

# NEXT_PUBLIC_* is inlined into the client bundle during `next build`, so anything meant to reach
# the browser has to exist *here*. An undeclared --build-arg is accepted and silently dropped,
# which is how a deploy passing NEXT_PUBLIC_APP_NAME ends up with a browser tab still showing the
# default.
#
# Note these are also read on the server through a dynamic key, and a dynamic read is never
# inlined — so the values a server component uses must ALSO be present as ordinary environment
# variables on the running container. Build arg and runtime variable, for the two different
# places they are read.
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

# The path this app is served under, when an edge puts several services on one host behind
# prefixes. Next bakes basePath and assetPrefix into the output at build time, so it has to be
# a build arg: a value set only on the running container arrives after the URLs are written,
# and the app serves assets from the site root where another service answers.
ARG BASE_PATH
ENV BASE_PATH=${BASE_PATH}

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter "@imgc/app-${APP}" build

FROM base AS runner
ARG APP=shell
ENV APP=${APP}
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output keeps the workspace layout: the server is at apps/<app>/server.js, with the
# workspace packages traced in beside it.
COPY --from=builder /app/apps/${APP}/.next/standalone ./
COPY --from=builder /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder /app/apps/${APP}/public ./apps/${APP}/public

EXPOSE 3000

CMD ["sh", "-c", "node apps/${APP}/server.js"]
