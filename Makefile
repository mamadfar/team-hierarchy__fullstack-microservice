# Orbit — single command entrypoint. Run `make help`.
SHELL := /bin/sh
# compose interpolates from the invoking shell, not the repo .env (its project
# dir is infra/docker) — pass the root .env explicitly when it exists.
ENV_FILE     := $(wildcard .env)
COMPOSE_ENV  := $(if $(ENV_FILE),--env-file $(ENV_FILE),)
COMPOSE      := docker compose $(COMPOSE_ENV) -f infra/docker/docker-compose.yml
COMPOSE_DEV  := docker compose $(COMPOSE_ENV) -f infra/docker/docker-compose.dev.yml

.DEFAULT_GOAL := help

# make key NAME=SYNC_APP_TOKEN [LENGTH=32|64]
NAME ?=
LENGTH ?= 64

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Install deps + copy .env.example -> .env if missing
	pnpm install
	@test -f .env || cp .env.example .env

key: ## Generate a crypto secret: make key NAME=SYNC_APP_TOKEN [LENGTH=32|64]
	@if [ -z "$(NAME)" ]; then \
	  echo "Usage: make key NAME=SYNC_APP_TOKEN [LENGTH=32|64]"; \
	  echo "  NAME    env var label to print (e.g. SYNC_APP_TOKEN, GEMINI_API_KEY)"; \
	  echo "  LENGTH  32 or 64 hex chars (default 64)"; \
	  exit 1; \
	fi; \
	if [ "$(LENGTH)" != "32" ] && [ "$(LENGTH)" != "64" ]; then \
	  echo "LENGTH must be 32 or 64 (got: $(LENGTH))"; \
	  exit 1; \
	fi; \
	KEY=$$(node -e "process.stdout.write(require('crypto').randomBytes($(LENGTH)/2).toString('hex'))"); \
	echo ""; \
	echo "$(NAME)=$$KEY"; \
	echo ""; \
	echo "Add to .env (or: gh secret set $(NAME) --body \"$$KEY\")"

dev-infra: ## Start local postgres + redis only (for `make dev`)
	$(COMPOSE_DEV) up -d --wait

dev: ## Run web + both services in watch mode (needs dev-infra)
	pnpm run dev

build: ## Build all packages
	pnpm run build

lint: ## Lint all packages
	pnpm run lint

typecheck: ## Typecheck all packages
	pnpm run typecheck

test: ## Unit tests, all packages
	pnpm run test

test-integration: ## Integration tests (against dockerized postgres + redis)
	$(COMPOSE_DEV) up -d --wait
	pnpm run test:integration

eval: ## RAG retrieval eval vs eval/golden.jsonl (top-1 / top-3)
	pnpm run eval

db-migrate: ## Apply Drizzle migrations
	pnpm run db:migrate

db-seed: ## Seed database from infra/db/seed/registry.json (dev only)
	pnpm run db:seed

sync: ## Trigger a registry sync on the running local stack
	curl -sf -X POST -H "Authorization: Bearer $${SYNC_APP_TOKEN:-dev-sync-token}" http://localhost:4001/sync

docker-build: ## Build all docker images
	$(COMPOSE) build

docker-up: ## Boot the full stack (web, services, postgres, redis)
	$(COMPOSE) up -d --build --wait

docker-down: ## Stop the full stack
	$(COMPOSE) down

ci: ## What CI runs: lint, typecheck, unit tests, build
	pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build

.PHONY: help setup key dev-infra dev build lint typecheck test test-integration eval db-migrate db-seed sync docker-build docker-up docker-down ci
