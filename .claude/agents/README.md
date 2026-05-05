# Agent Index

Agents are organized by category. Each is a standalone `.md` file with YAML frontmatter.

## Categories

| Category | Agents | Description |
|----------|--------|-------------|
| `core/` | coder, planner, researcher, reviewer, tester | Fundamental development roles |
| `development/` | backend/dev-backend-api, tanstack-router-expert | Framework and API specialists |
| `languages/` | javascript-pro, react-specialist, typescript-pro | Language and library experts |
| `quality/` | code-reviewer, performance-engineer, security-auditor | Code quality and review |
| `testing/` | accessibility-test-expert, e2e-playwright-specialist, performance-test-engineer, security-test-specialist, testing-accessibility-auditor, testing-api-tester, testing-evidence-collector, testing-performance-benchmarker, testing-reality-checker, testing-test-results-analyzer, testing-tool-evaluator, testing-workflow-optimizer, unit-test-specialist, validation/production-validator | Testing strategy and execution |
| `debugging/` | sentry-investigator | Production error investigation |
| `devops/` | build-engineer, ci-cd/ops-cicd-github, dependency-manager, git-workflow-manager | CI/CD and infrastructure |
| `security/` | security-review-specialist | Security auditing and review |
| `documentation/` | api-docs/docs-api-openapi | API documentation |
| `meta/` | skill-creator | Agent and skill authoring |
| `sparc/` | architecture, pseudocode, refinement, specification | SPARC methodology phases |

## Usage

Agents are loaded by the Claude Code / OpenCode runtime. Reference by path:

```
.claude/agents/core/coder.md
.claude/agents/languages/react-specialist.md
```

## Adapted from ServerlessBase

These agents were ported from the ServerlessBase project and adapted for a generic MERN stack (MongoDB, Express, React, Node). All references to Convex, tRPC, Drizzle ORM, Better-Auth, Docker Swarm, Traefik, and product-specific branding have been removed or replaced.
