# syntax=docker/dockerfile:1
# ============================================================================
# apps/web — Next.js frontend (multi-stage, non-root runtime).
# Build context = REPO ROOT:  docker build -f infra/docker/web.Dockerfile .
#
# CONTRACT with apps/web:
#   - next.config must set  output: "standalone"  (and ideally
#     outputFileTracingRoot pointed at the monorepo root) so the runtime stage
#     can copy .next/standalone.
#   - apps/web/public must exist (even if only a .gitkeep).
# ============================================================================

# ---- base: node + corepack-managed pnpm --------------------------------------
# corepack activates the exact pnpm from "packageManager" in the root
# package.json (pnpm@11.x) the first time pnpm runs — no version hardcoded here.
# corepack@latest first: older bundled corepack builds fail signature
# verification against newer pnpm releases.
FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache libc6-compat \
  && npm install -g corepack@latest \
  && corepack enable
WORKDIR /app

# ---- deps: install the whole workspace from the lockfile ---------------------
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

# ---- build: shared first, then the app ---------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* are inlined into the client bundle AT BUILD TIME (public,
# non-secret). Defaults match the local docker-compose stack, where the
# browser reaches the services on published localhost ports.
ARG NEXT_PUBLIC_REGISTRY_API_URL=http://localhost:4001
ARG NEXT_PUBLIC_ASSISTANT_API_URL=http://localhost:4002
# Default carries "{queueKey}" placeholder braces, which docker-compose
# ${VAR:-default} interpolation cannot express — so the default lives here.
ARG NEXT_PUBLIC_TICKET_URL_TEMPLATE=https://jira.company.com/secure/CreateIssue.jspa?pid={queueKey}
ENV NEXT_PUBLIC_REGISTRY_API_URL=$NEXT_PUBLIC_REGISTRY_API_URL \
    NEXT_PUBLIC_ASSISTANT_API_URL=$NEXT_PUBLIC_ASSISTANT_API_URL \
    NEXT_PUBLIC_TICKET_URL_TEMPLATE=$NEXT_PUBLIC_TICKET_URL_TEMPLATE \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter ./packages/shared run build \
  && pnpm --filter ./apps/web run build

# ---- runtime: standalone output only, non-root -------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# .next/standalone mirrors the monorepo layout (server entry at apps/web/server.js)
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
# busybox wget ships with alpine; web has no /health — probe the root page
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", "apps/web/server.js"]
