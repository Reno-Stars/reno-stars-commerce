# syntax=docker/dockerfile:1
#
# medusa-storefront — Next.js 15 storefront (supply.reno-stars.com), port 8000
#
# Build context: this directory (storefront/). backend/ and storefront/ are
# independent apps with independent lockfiles — this is not a yarn workspace:
#
#   docker build --platform linux/amd64 -f storefront/Dockerfile \
#     --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://supply-admin.reno-stars.com \
#     --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_... \
#     -t medusa-storefront:x storefront
#
# NEXT_PUBLIC_* are INLINED INTO THE CLIENT BUNDLE AT BUILD TIME. Setting them in
# a k8s Deployment's env: does not change an already-built image — the browser
# bundle keeps whatever was passed here. They must be build args, which means one
# image per environment (or a runtime-config refactor). The same variables are
# also read server-side at request time (middleware.ts, lib/config.ts), so they
# are set as runtime ENV as well; keep the two consistent.

ARG NODE_VERSION=22-bookworm-slim

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps

ENV YARN_ENABLE_TELEMETRY=0 \
    CI=true

WORKDIR /app

# corepack activates the yarn version pinned in "packageManager" (yarn@4.4.0,
# with an integrity hash), so package.json must land before yarn runs.
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && corepack prepare yarn@4.4.0 --activate && yarn --version

# Berry's CI install. --immutable == --frozen-lockfile: fails rather than
# silently rewriting yarn.lock. .yarnrc.yml pins nodeLinker: node-modules and
# enableGlobalCache: false, so the cache is written under /app/.yarn/cache and
# dropped with this stage.
RUN yarn install --immutable

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# This is a FRESH base image — corepack being enabled in the deps stage does not
# carry over, and node:* ships yarn 1.22.22 globally. Without this, `yarn build`
# dies with "packageManager defines yarn@4.4.0 however the current global version
# of Yarn is 1.22.22" before Next is ever invoked.
RUN corepack enable && corepack prepare yarn@4.4.0 --activate && yarn --version

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_DEFAULT_REGION=ca
ARG NEXT_PUBLIC_STRIPE_KEY
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${NEXT_PUBLIC_MEDUSA_BACKEND_URL} \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_DEFAULT_REGION=${NEXT_PUBLIC_DEFAULT_REGION} \
    NEXT_PUBLIC_STRIPE_KEY=${NEXT_PUBLIC_STRIPE_KEY} \
    NEXT_PUBLIC_PAYPAL_CLIENT_ID=${NEXT_PUBLIC_PAYPAL_CLIENT_ID} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Emit .next/standalone as well as .next — see the gate in next.config.js.
ENV NEXT_BUILD_STANDALONE=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# check-env-variables.js runs inside next.config.js and calls process.exit(1) if
# NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is unset, so the build fails fast (exit 1)
# rather than producing a bundle that cannot talk to Medusa.
RUN yarn build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8000

# The standalone server binds process.env.HOSTNAME. Next's own default is
# 0.0.0.0, so this changes nothing — it makes the bind address explicit and
# overridable. A container bound to 127.0.0.1 is unreachable from a k8s Service
# while every in-container probe still passes, which is the failure mode this
# line exists to rule out.
ENV HOSTNAME=0.0.0.0

# Server-side reads of these happen at request time (middleware.ts region lookup,
# lib/config.ts SDK). They must MATCH the build args above; the client half of
# the app is already frozen to the build-time values.
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_DEFAULT_REGION=ca
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${NEXT_PUBLIC_MEDUSA_BACKEND_URL} \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_DEFAULT_REGION=${NEXT_PUBLIC_DEFAULT_REGION}

# node:* ships an unprivileged `node` user (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 8000

# NOTE (probes): there is no backend-independent health route. middleware.ts
# matches everything except /api, /_next/* and static assets, and it fetches
# {BACKEND_URL}/store/regions on the request path — so every HTML request fails
# if Medusa is down, and the app has no /api route to probe instead. Point the
# k8s probes at a static asset (e.g. GET /favicon.ico, which the matcher
# excludes) or add an /api/health route; do NOT probe /, or a backend blip will
# roll every storefront pod.
#
# NOTE (redirects): a cookieless request to / is answered with a 307 by design —
# middleware sets _medusa_cache_id and redirects. `curl -L` without a cookie jar
# loops until it hits its 50-redirect cap. Verify with `curl -L -c jar -b jar`.
CMD ["node", "server.js"]
