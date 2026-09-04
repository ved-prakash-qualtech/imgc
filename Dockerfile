# Production image. At the repository root on purpose: the QShip deploy wrapper takes a
# Dockerfile *name*, not a path — "refused: dockerfile must be a file name, not a path" — so a
# build file under docker/ cannot be deployed at all. The dev image stays in docker/, where only
# docker-compose.dev.yml looks for it.
# Production: multi-stage build with Next.js standalone output.
FROM node:24.17.0-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
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
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
