# syntax=docker/dockerfile:1
# ============================================================================
# apps/services/assistant-service — RAG chat API (NestJS).
# Build context = REPO ROOT:
#   docker build -f infra/docker/assistant-service.Dockerfile .
#
# CONTRACT with the assistant-service code:
#   - `pnpm run build` emits dist/main.js (nest build default).
#   - "@orbit/shared" is a production dependency (not a devDependency).
#   - The HTTP server binds 0.0.0.0 and serves GET /health on $ASSISTANT_PORT.
#   - No migrations or seed here: registry-service owns the schema and the
#     seed ingestion; assistant reads team_documents from the shared database.
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
COPY apps/services/assistant-service ./apps/services/assistant-service
RUN pnpm --filter ./packages/shared run build \
  && pnpm --filter ./apps/services/assistant-service run build

# ---- prod-deps: production-only node_modules for this service + shared -------
# Fresh install (not pruned from the dev install) so node_modules/.pnpm contains
# ONLY what assistant-service and its workspace deps need at runtime.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/services/registry-service/package.json apps/services/registry-service/
COPY apps/services/assistant-service/package.json apps/services/assistant-service/
RUN pnpm install --frozen-lockfile --prod --filter "{./apps/services/assistant-service}..."

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
COPY --from=prod-deps --chown=node:node /app/apps/services/assistant-service/node_modules ./apps/services/assistant-service/node_modules
COPY --from=build     --chown=node:node /app/apps/services/assistant-service/package.json ./apps/services/assistant-service/package.json
COPY --from=build     --chown=node:node /app/apps/services/assistant-service/dist ./apps/services/assistant-service/dist

ENV ASSISTANT_PORT=4002

USER node
EXPOSE 4002
# busybox wget ships with alpine
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s --retries=10 \
  CMD wget -qO- http://127.0.0.1:4002/health >/dev/null 2>&1 || exit 1
CMD ["node", "apps/services/assistant-service/dist/main.js"]
