# Generate & Maintain ARCHITECTURE.md

## Objective

Explore this project from scratch, understand its full architecture, and produce two deliverables:

1. A comprehensive `ARCHITECTURE.md` at the project root
2. A Claude rule at `.claude/rules/architecture-doc-maintenance.md` that keeps the doc current

---

## Phase 1: Discovery

Before writing anything, systematically explore the project. Do ALL of the following:

### 1.1 Repository Structure
- List the top-level directory tree (2-3 levels deep)
- Identify monorepo boundaries (e.g., `apps/`, `packages/`, `services/`)
- Note any workspace configuration (package.json workspaces, pnpm-workspace.yaml, Cargo.toml workspace, go.work, etc.)

### 1.2 Tech Stack Detection
- Check package managers and dependency files (package.json, Cargo.toml, go.mod, pyproject.toml, Gemfile, mix.exs, etc.)
- Identify frameworks (React, Next.js, Express, Django, Rails, Phoenix, Axum, etc.)
- Identify databases (look for schema files, migrations, ORM config, docker-compose DB services)
- Identify infrastructure (Docker, Kubernetes, Terraform, serverless configs)
- Check for CI/CD configuration (.github/workflows, .gitlab-ci.yml, Jenkinsfile, etc.)

### 1.3 Service Map
- Parse docker-compose files for all services, ports, networks, and volumes
- Check for Makefiles, Taskfiles, or scripts that reveal service orchestration
- Identify inter-service communication (API calls, message queues, shared databases)
- Map external ports to internal ports and production domains (check nginx/traefik/ingress configs, env files)

### 1.4 Database Schema
- Find schema definition files (SQL migrations, ORM schema files, Prisma schema, Drizzle schema, etc.)
- List all tables/collections with their purpose
- Identify key relationships (foreign keys, references)
- Note any multi-database setups

### 1.5 API Layer
- Find API route definitions (routers, controllers, handlers)
- Identify API patterns (REST, GraphQL, tRPC, gRPC, WebSocket)
- Check authentication/authorization mechanisms
- Note any API gateway or proxy configurations

### 1.6 Cross-Cutting Concerns
- Authentication system (OAuth, JWT, sessions, etc.)
- Internationalization (i18n frameworks, locale files)
- Feature flags (config files, feature flag services)
- Logging and monitoring (observability stack)
- Error handling patterns
- Caching strategy

### 1.7 Development Workflow
- Check README.md for setup instructions
- Check Makefile/Taskfile for available commands
- Identify test frameworks and test commands
- Identify build and deploy processes
- Check for existing CLAUDE.md or .claude/ configuration

---

## Phase 2: Generate ARCHITECTURE.md

Write `ARCHITECTURE.md` at the project root with the following sections. Adapt section depth and content based on what you discovered. Skip sections that don't apply. Add sections for patterns unique to this project.

### Required Sections

```
# Architecture

## 1. High-Level Overview
- One-paragraph project description
- ASCII system diagram showing all services and their connections
- Production domain/URL table (if applicable)

## 2. Repository Structure
- Annotated directory tree (top 2-3 levels)
- Purpose of each top-level directory
- Monorepo package/app boundaries (if applicable)

## 3. Tech Stack
- Table format: Layer | Technology | Version (if notable)
- Cover: Language, Framework, Database, Cache, Queue, Proxy, CI/CD, Hosting

## 4. Services & Infrastructure
- Table: Service | Port (dev) | Port (prod) | Domain | Description
- Docker/container configuration summary
- Network topology
- Resource constraints (if defined)

## 5. Database
- Schema overview: Table | Purpose | Key Columns
- Entity relationship summary (text or ASCII diagram)
- Migration strategy and tooling
- Multi-database setup (if applicable)

## 6. API Layer
- Router/controller inventory: Router | Procedures/Endpoints | Auth Level
- API patterns and conventions
- Authentication flow
- Error handling patterns

## 7. Frontend Architecture (if applicable)
- Component organization
- State management approach
- Routing strategy
- Styling system

## 8. Key Architectural Patterns
- Design patterns used (service layer, repository pattern, CQRS, etc.)
- Code organization conventions
- Naming conventions
- File size/structure guidelines

## 9. Environment & Configuration
- Environment variable strategy (where defined, how loaded)
- Configuration hierarchy
- Secrets management approach

## 10. Development Workflow
- Setup commands (install, start, build)
- Testing commands and strategy
- Linting and type checking
- Common development scenarios

## 11. Cross-Cutting Concerns
- Authentication & authorization
- Internationalization (if applicable)
- Feature flags (if applicable)
- Logging & monitoring
- Error handling
- Caching

## 12. Deployment
- Build process
- Deployment strategy
- Environment promotion flow (dev -> staging -> prod)

## 13. Keeping This Document Updated
- Reference the maintenance rule
- List what changes trigger updates
```

### Writing Guidelines

- Be factual and concise. Describe what IS, not what should be.
- Use tables for structured data (services, ports, routers, schema).
- Use ASCII diagrams for system topology. Keep them readable.
- Include actual file paths so readers can navigate to source.
- Count things (e.g., "46 schema files", "12 tRPC routers") to give scale.
- Do not include implementation details or code snippets unless they illustrate a unique pattern.
- Do not repeat information available in README.md. Reference it instead.
- If an existing ARCHITECTURE.md exists, read it first. Preserve any manually-written context that is still accurate. Update or replace sections that are outdated.

---

## Phase 3: Create Architecture Maintenance Rule

Write `.claude/rules/architecture-doc-maintenance.md` with the following content (adapt to what you found in the project):

```markdown
# Architecture Document Maintenance - Best Practice Guide

## RECOMMENDED PRACTICE

When making **major structural changes** to the codebase, update `ARCHITECTURE.md` at the project root to keep it accurate.

## What Counts as a Major Structural Change

### MUST Update ARCHITECTURE.md

- Adding or removing a top-level directory
- Adding or removing a service (Docker, serverless function, microservice)
- Adding or removing a database, cache, or queue
- Changing service ports, domains, or network topology
- Adding a new API router, controller group, or GraphQL schema module
- Adding or removing database tables/collections
- Changing authentication or authorization mechanisms
- Adding a new major feature area (new route group, new module)
- Changing the build system, CI/CD, or deployment infrastructure
- Adding or removing a supported language (i18n)
- Changing the proxy/gateway architecture

### Does NOT Require Updates

- Bug fixes
- Styling or CSS changes
- Adding translations within existing namespaces
- New components within existing feature areas
- Adding endpoints to existing routers (unless it's a new router)
- Dependency version bumps (unless major framework migration)
- Modifying existing API procedures without adding new routers

## How to Update

1. Open `ARCHITECTURE.md` at the project root
2. Find the relevant section for the change
3. Update the description, table, or list to reflect the new state
4. Keep descriptions concise and factual
5. Update counts only when they change significantly

## Section Reference

[List the actual sections from the generated ARCHITECTURE.md with brief descriptions of what each covers]
```

If this rule file already exists, read it first and merge your updates with the existing content. Do not discard manually-added rules.

---

## Execution Order

1. Run all discovery steps (Phase 1) in parallel where possible
2. Synthesize findings into ARCHITECTURE.md (Phase 2)
3. Create or update the maintenance rule (Phase 3)
4. Report what you created and any areas where the architecture was unclear or inconsistent
