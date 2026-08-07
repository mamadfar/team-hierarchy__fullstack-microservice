# syntax=docker/dockerfile:1
# ============================================================================
# apps/services/registry-service — Confluence ingestion + registry API (NestJS).
# Build context = REPO ROOT:
#   docker build -f infra/docker/registry-service.Dockerfile .
#
# CONTRACT with the registry-service code:
#   - `pnpm run build` emits dist/main.js (nest build default) and copies the
#     migration .sql assets into dist/database/migrations (nest-cli.json assets),
#     where the boot-time Migrator resolves them relative to __dirname.
#   - MOCK_CONFLUENCE=true reads the seed from $SEED_PATH
#     (default /app/seed/registry.json, bundled below).
#   - "@orbit/shared" is a production dependency (not a devDependency).
#   - The HTTP server binds 0.0.0.0 and serves GET /health on $REGISTRY_PORT.
# ============================================================================

# ---- base: node + corepack-managed pnpm --------------------------------------
# corepack activates the exact pnpm from "packageManager" in the root
# package.json (pnpm@11.x) the first time pnpm runs — no version hardcoded here.
# corepack@latest first: older bundled corepack builds fail signature
# verification against newer pnpm releases.
FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# ---- deps: full workspace install from the lockfile --------------------------
# NOTE: pnpm-lock.yaml only exists after the integrator has run `pnpm install`
# once at the repo root — docker builds are expected to happen after that step.
# All workspace manifests must be present for --frozen-lockfile to resolve.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/services/registry-service/package.json apps/services/registry-service/
COPY apps/services/assistant-service/package.json apps/services/assistant-service/
RUN pnpm install --frozen-lockfile

# ---- build: shared first, then the service -----------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/registry-service ./apps/services/registry-service
RUN pnpm --filter ./packages/shared run build \
  && pnpm --filter ./apps/services/registry-service run build

# ---- prod-deps: production-only node_modules for this service + shared -------
# Fresh install (not pruned from the dev install) so node_modules/.pnpm contains
# ONLY what registry-service and its workspace deps need at runtime.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/services/registry-service/package.json apps/services/registry-service/
COPY apps/services/assistant-service/package.json apps/services/assistant-service/
RUN pnpm install --frozen-lockfile --prod --filter "{./apps/services/registry-service}..."

# ---- runtime: slim, non-root -------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The workspace directory layout is preserved so pnpm's relative symlinks
# (node_modules/@orbit/shared -> ../../packages/shared, .pnpm store) resolve.
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build     --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build     --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps --chown=node:node /app/apps/services/registry-service/node_modules ./apps/services/registry-service/node_modules
COPY --from=build     --chown=node:node /app/apps/services/registry-service/package.json ./apps/services/registry-service/package.json
COPY --from=build     --chown=node:node /app/apps/services/registry-service/dist ./apps/services/registry-service/dist

# Seed fixtures — MOCK_CONFLUENCE=true ingests from $SEED_PATH instead of the
# Confluence API, so the stack runs fully offline.
COPY --chown=node:node infra/db/seed ./seed

ENV SEED_PATH=/app/seed/registry.json \
    REGISTRY_PORT=4001

USER node
EXPOSE 4001
# busybox wget ships with alpine
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s --retries=10 \
  CMD wget -qO- http://127.0.0.1:4001/health >/dev/null 2>&1 || exit 1
CMD ["node", "apps/services/registry-service/dist/main.js"]
