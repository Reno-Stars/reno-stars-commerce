# syntax=docker/dockerfile:1
#
# medusa-backend — Medusa 2.8.4 server + admin UI (supply-admin.reno-stars.com)
#
# Build context: this directory (backend/). This is NOT a yarn workspace root —
# backend/ and storefront/ are independent apps with independent lockfiles:
#
#   docker build --platform linux/amd64 -f backend/Dockerfile -t medusa-backend:x backend
#
# ─────────────────────────────────────────────────────────────────────────────
# SINGLE REPLICA ONLY — replicas: 1, strategy: Recreate.
# medusa-config.ts pins Modules.CACHE to @medusajs/medusa/cache-inmemory and
# Modules.WORKFLOW_ENGINE to @medusajs/medusa/workflow-engine-inmemory. Both keep
# state in the process heap, so a second replica gets its own cache and its own
# workflow state: long-running workflows (quotes, approvals, order edits) would
# be stepped by one pod and resumed by another that has never heard of them, and
# cache invalidation would only ever reach one pod. Scaling out REQUIRES swapping
# those two modules for the Redis-backed ones first (REDIS_URL is already set).
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-bookworm-slim

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder

ENV YARN_ENABLE_TELEMETRY=0 \
    MEDUSA_DISABLE_TELEMETRY=true \
    CI=true

WORKDIR /app

# corepack activates the yarn version pinned in package.json ("packageManager":
# "yarn@4.4.0"). Berry is resolved from that field, so it must be copied first.
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && corepack prepare yarn@4.4.0 --activate && yarn --version

# --immutable is Berry's equivalent of npm ci / --frozen-lockfile: it fails if
# yarn.lock would have to change. .yarnrc.yml pins nodeLinker: node-modules.
RUN yarn install --immutable

# Sources needed by `medusa build`: the config, the TS config, the admin
# extension build (tailwind preset) and src/ itself.
COPY tsconfig.json tailwind.config.js medusa-config.ts ./
COPY src ./src

# `medusa build` emits a self-contained server into .medusa/server (compiled JS,
# its own package.json + yarn.lock) and the compiled admin UI into
# .medusa/server/public/admin. No database is contacted at build time.
RUN yarn build

# `medusa build` copies package.json and yarn.lock into .medusa/server but NOT
# .yarnrc.yml. On the Mac that is invisible: Yarn walks up the directory tree and
# picks up backend/.yarnrc.yml. In an image .medusa/server is copied out on its
# own, that ancestor is gone, and Yarn 4 falls back to its DEFAULT linker (PnP) —
# which Medusa's dynamic module resolution does not survive. Pin it explicitly.
RUN printf 'nodeLinker: node-modules\n' > .medusa/server/.yarnrc.yml

# Runtime dependency tree for the compiled server. `yarn install --production`
# is npm/yarn-classic syntax and is NOT a Berry flag; the Berry equivalent is
# `yarn workspaces focus --production` (workspace-tools ships in Yarn 4's default
# bundle). YARN_ENABLE_IMMUTABLE_INSTALLS keeps it honest — focus has no
# --immutable flag of its own, so the lockfile guarantee comes from the env var.
# The lockfile itself is already proven by the --immutable install above:
# .medusa/server/{package.json,yarn.lock} are byte-identical copies of the ones
# in this directory, so this resolves the same graph, minus devDependencies.
WORKDIR /app/.medusa/server
RUN YARN_ENABLE_IMMUTABLE_INSTALLS=true yarn workspaces focus --production && \
    yarn cache clean --all && \
    rm -rf .yarn/cache .yarn/install-state.gz

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production \
    MEDUSA_DISABLE_TELEMETRY=true \
    PORT=9000

# `medusa start` binds http.listen(port, process.env.HOST). With HOST unset Node
# binds every interface, which is what the Mac does today, so setting 0.0.0.0
# here changes nothing about behaviour — it makes the bind address explicit and
# overridable instead of implicit. A k8s Service can only reach a container that
# is NOT bound to loopback, and a probe running inside the container cannot tell
# the two apart.
ENV HOST=0.0.0.0

WORKDIR /app

# Non-root. node:* images ship an unprivileged `node` user (uid 1000).
COPY --from=builder --chown=node:node /app/.medusa/server ./

USER node

EXPOSE 9000

# NOTE (uploads): the default file provider writes to ./static relative to this
# cwd. That path is ephemeral in a container — mount a PVC at /app/static or
# switch to the S3 file provider before serving uploads from k8s.
#
# NOTE (migrations): `medusa start` does NOT run migrations. Run
# `npx medusa db:migrate` as a Job/initContainer against DATABASE_URL first.
#
# NOTE (probes): GET /health returns 200 "OK", but the route is registered only
# AFTER the module loaders connect to Postgres. It is a readiness signal, not a
# liveness-only ping — see the finding in the containerisation report.
CMD ["./node_modules/.bin/medusa", "start"]
