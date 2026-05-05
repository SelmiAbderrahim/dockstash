# OpenCode Configuration

This directory contains the OpenCode agent and command definitions for the MERN Starter project.

## Structure

```
.opencode/
├── agent/              # 37 specialized agents (flat layout)
├── command/            # 9 SpecKit slash commands
└── README.md           # This file

opencode.jsonc          # Provider/model config + permissions (project root)
```

## Agents

### Core
| Agent | Description |
|-------|-------------|
| `coder` | Implementation specialist |
| `planner` | Task decomposition and planning |
| `researcher` | Codebase analysis and research |
| `tester` | Testing and QA |
| `code-reviewer` | Code review (read-only) |

### SPARC Methodology
| Agent | Description |
|-------|-------------|
| `arch-system-design` | System architecture design |
| `specification` | Requirements and acceptance criteria |
| `pseudocode` | Algorithm design and logic flow |
| `implementer-sparc-coder` | TDD implementation |
| `refinement` | Optimization and quality improvement |

### Development
| Agent | Description |
|-------|-------------|
| `dev-backend-api` | REST API development |
| `react-specialist` | React 18 components and patterns |
| `typescript-pro` | TypeScript strict mode expert |
| `javascript-pro` | Modern ES2023+ patterns |
| `tanstack-router-expert` | File-based routing |

### DevOps
| Agent | Description |
|-------|-------------|
| `build-engineer` | Vite builds and optimization |
| `dependency-manager` | Package security and updates |
| `git-workflow-manager` | Branching and PR automation |
| `ops-cicd-github` | GitHub Actions pipelines |

### Quality & Security
| Agent | Description |
|-------|-------------|
| `security-auditor` | Vulnerability scanning |
| `security-review-specialist` | Semantic security analysis |
| `security-test-specialist` | OWASP security testing |
| `performance-engineer` | Performance optimization |
| `docs-api-openapi` | OpenAPI documentation |

### Testing
| Agent | Description |
|-------|-------------|
| `unit-test-specialist` | Vitest unit testing |
| `e2e-playwright-specialist` | Playwright E2E testing |
| `accessibility-test-expert` | WCAG 2.1 AA compliance |
| `production-validator` | Deployment readiness |

### Meta
| Agent | Description |
|-------|-------------|
| `skill-creator` | Create new OpenCode skills |
| `testing-*` | 8 specialized testing agents |
| `sentry-investigator` | Production error investigation |

## Commands

All commands use the SpecKit slash command pattern:

| Command | Description |
|---------|-------------|
| `/speckit.constitution` | Define project constitution |
| `/speckit.specify` | Create specifications |
| `/speckit.plan` | Plan implementation |
| `/speckit.tasks` | Generate task list |
| `/speckit.implement` | Implement from spec |
| `/speckit.analyze` | Analyze requirements |
| `/speckit.clarify` | Clarify ambiguities |
| `/speckit.checklist` | Quality checklist |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |

## Configuration

See `opencode.jsonc` at the project root for:
- Provider configuration (Anthropic)
- Default model settings
- Permission policies
- MCP server connections

## API Keys

Set via environment variables or `.opencode/local.json` (git-ignored):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
