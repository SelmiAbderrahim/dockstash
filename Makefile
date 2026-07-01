# Dockstash — Docker control plane.
# All targets run through `docker compose` against the `dockstash` project
# (project name is set via `name:` in docker-compose.yml). Config comes from
# the root .env. Run `make help` for the target list.

SHELL := /bin/bash
COMPOSE := docker compose

# Overall timeout (seconds) for `wait-healthy` before it gives up.
HEALTH_TIMEOUT ?= 300

.DEFAULT_GOAL := help
.PHONY: help build up build-up deploy down stop restart ps logs health \
        wait-healthy config sh-api sh-web pull test test-server test-client

help: ## Show this help
	@echo "Dockstash — make targets:"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

build: ## Build all service images
	$(COMPOSE) build

up: ## Start the stack (detached), then wait until all containers are healthy
	$(COMPOSE) up -d
	@$(MAKE) --no-print-directory wait-healthy

build-up: ## Build + start (detached), then wait until all containers are healthy
	$(COMPOSE) up -d --build
	@$(MAKE) --no-print-directory wait-healthy

deploy: build-up ## Alias for build-up

down: ## Stop and remove containers (volumes are PRESERVED)
	$(COMPOSE) down

stop: ## Stop containers without removing them
	$(COMPOSE) stop

restart: ## Restart all services
	$(COMPOSE) restart

ps: ## Show container status
	$(COMPOSE) ps

logs: ## Follow logs from all services (last 100 lines)
	$(COMPOSE) logs -f --tail=100

pull: ## Pull the latest base images (mongo, redis, socket-proxy)
	$(COMPOSE) pull

config: ## Validate compose file + .env interpolation
	$(COMPOSE) config

health: ## Print each service's health state once
	@$(COMPOSE) ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'

# Block until every service that declares a healthcheck reports "healthy".
# Fails fast if any service is "unhealthy" or has exited; gives up after
# $(HEALTH_TIMEOUT) seconds. Uses per-container `docker inspect` so services
# without a healthcheck are ignored.
wait-healthy: ## Wait until all containers report healthy (fails on unhealthy/exit/timeout)
	@echo "Waiting for all containers to become healthy (timeout $(HEALTH_TIMEOUT)s)..."
	@deadline=$$(( $$(date +%s) + $(HEALTH_TIMEOUT) )); \
	while true; do \
		ids=$$($(COMPOSE) ps -q); \
		if [ -z "$$ids" ]; then echo "No containers running."; exit 1; fi; \
		pending=0; failed=0; summary=""; \
		for id in $$ids; do \
			name=$$(docker inspect -f '{{.Name}}' $$id | sed 's#^/##'); \
			state=$$(docker inspect -f '{{.State.Status}}' $$id); \
			health=$$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $$id); \
			summary="$$summary  $$name: state=$$state health=$$health\n"; \
			if [ "$$state" = "exited" ] || [ "$$state" = "dead" ] || [ "$$health" = "unhealthy" ]; then failed=1; fi; \
			if [ "$$health" = "starting" ] || [ "$$state" = "created" ] || [ "$$state" = "restarting" ]; then pending=1; fi; \
		done; \
		if [ "$$failed" = "1" ]; then \
			echo "A container is unhealthy or exited:"; echo -e "$$summary"; \
			echo "Recent logs:"; $(COMPOSE) ps; exit 1; \
		fi; \
		if [ "$$pending" = "0" ]; then \
			echo "All containers healthy:"; echo -e "$$summary"; exit 0; \
		fi; \
		if [ $$(date +%s) -ge $$deadline ]; then \
			echo "Timed out after $(HEALTH_TIMEOUT)s waiting for health:"; echo -e "$$summary"; exit 1; \
		fi; \
		sleep 5; \
	done

sh-api: ## Open a shell in the running api container
	$(COMPOSE) exec api sh

sh-web: ## Open a shell in the running web container
	$(COMPOSE) exec web sh

# Run the full test suite (server + client) on the host via vitest in
# single-run mode. Fails the whole target if either suite has a failing test.
test: test-server test-client ## Run all tests (server + client)

test-server: ## Run server tests (vitest, single run)
	cd server && npx vitest run

test-client: ## Run client tests (vitest, single run)
	cd client && npx vitest run
