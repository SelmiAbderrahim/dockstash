---
name: spec-driven-development
description: Comprehensive Spec-Driven Development skill using Spec Kit CLI for ServerlessBase project. Implements intent-driven development where specifications become executable, directly generating working implementations rather than just guiding them. Provides complete workflow from constitution definition through to implementation with quality validation.
license: MIT
metadata:
  version: "1.0"
  author: "Spec Kit Specialist"
  category: "development-workflow"
  project: "ServerlessBase"
  environment: "docker-only"
---

# Spec-Driven Development with Spec Kit

## Overview

**Spec-Driven Development** flips the script on traditional software development. For decades, code has been king — specifications were just scaffolding we built and discarded once the "real work" of coding began. Spec-Driven Development changes this: **specifications become executable**, directly generating working implementations rather than just guiding them.

**Keywords**: spec-driven development, specify-cli, spec kit, intent-driven development, requirements engineering, architecture planning, task breakdown, quality validation

**🚨 CRITICAL POLICY**: This skill enforces the complete Spec-Driven Development workflow using Spec Kit CLI, following all project-specific constraints including Docker-only development and ServerlessBase architecture patterns.

## When to Use This Skill

- **Greenfield Development**: Generate new features from scratch
- **Feature Iteration**: Add features to existing systems iteratively
- **Architecture Planning**: Define technical implementation plans
- **Requirements Clarification**: Ensure complete and unambiguous specifications
- **Quality Validation**: Validate specifications before implementation
- **Parallel Implementation**: Explore diverse technical solutions

## Spec Kit CLI Installation

Spec Kit CLI (`specify`) must be installed on your system:

```bash
# Install via uv (recommended)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Update to latest version
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git

# Verify installation
specify --version
specify check
```

## Development Workflow

### Phase 0: Initialize Spec Kit (First Time Only)

```bash
# Initialize Spec Kit in current project
specify init . --ai claude --force

# This creates:
# - .spec/ directory for specifications
# - Constitution template
# - Project structure
```

### Phase 1: Constitution (`/speckit.constitution`)

Define your project's governing principles and development guidelines:

**When to use:**
- First time setting up Spec Kit
- When project standards change
- When adding new quality requirements

**What it establishes:**
- Core development principles
- Technical constraints and standards
- Architecture guidelines
- Testing and documentation requirements

**Example:**

```bash
# Create comprehensive constitution
/speckit.constitution

# Result: Defines principles for:
# - Docker-only development policy
# - RTL support requirements
# - Shadcn UI compliance
# - tRPC API patterns
# - Service component structure
```

### Phase 2: Specification (`/speckit.specify`)

Define WHAT you want to build (requirements and user stories):

**When to use:**
- Starting a new feature or component
- Refining existing requirements
- Documenting user needs

**What to include:**
- Problem statement (what and why, not how)
- User stories with acceptance criteria
- Functional requirements
- Non-functional requirements (performance, security, accessibility)
- Success criteria

**Example:**

```bash
# Define MySQL database service
/speckit.specify I want to add a MySQL database service to the ServerlessBase dashboard. Users should be able to create, manage, monitor, and backup MySQL databases through the UI.

# Result: Creates specification document covering:
# - User stories for developers and DevOps engineers
# - Functional requirements (CRUD, monitoring, backups)
# - Non-functional requirements (performance, security)
# - Integration points with existing system
```

### Phase 3: Clarification (`/speckit.clarify`)

Identify and resolve underspecified areas:

**When to use:**
- Before planning (recommended)
- When specifications feel incomplete
- When edge cases are unclear

**What it clarifies:**
- Edge cases and boundary conditions
- Error handling strategies
- User experience details (empty states, loading states)
- Integration requirements

**Example:**

```bash
# Clarify MySQL service specification
/speckit.clarify

# Generates clarifying questions:
# - What happens when container fails to start?
# - How should system handle connection timeouts?
# - What's the maximum number of databases?
# - Should backups be automatic or manual?
```

### Phase 4: Planning (`/speckit.plan`)

Create technical implementation plan with chosen tech stack:

**When to use:**
- After specification is complete and clarified
- Before creating tasks
- When exploring different technical approaches

**What to include:**
- Tech stack selection (match existing patterns)
- Architecture decisions
- Implementation strategy
- Development workflow

**Example:**

```bash
# Plan MySQL service implementation
/speckit.plan The service uses React 18, TypeScript, TanStack Router, TanStack Query, and Shadcn UI. Backend connects via tRPC to ServerlessBase API. MySQL runs in Docker container. Monitoring uses Recharts for charts.

# Result: Creates technical plan with:
# - Tech stack aligned with ServerlessBase
# - Service component structure (tabs pattern)
# - tRPC integration points
# - Phase-based development approach
```

### Phase 5: Task Breakdown (`/speckit.tasks`)

Convert technical plan into actionable task list:

**When to use:**
- After planning is complete
- Before implementation
- When refining implementation strategy

**What to include:**
- Individual tasks with acceptance criteria
- Task dependencies
- Priority ordering
- Parallelizable tasks

**Example:**

```bash
# Generate task list for MySQL service
/speckit.tasks

# Result: Generates 10+ tasks:
# 1. Create service component structure
# 2. Implement tRPC integration
# 3. Build general tab
# 4. Build environment tab
# 5. Build logs tab
# 6. Build monitoring tab
# 7. Build backups tab
# 8. Build advanced tab
# 9. Add route and navigation
# 10. Testing
```

### Phase 6: Analysis (`/speckit.analyze`)

Validate consistency and coverage across all artifacts:

**When to use:**
- After task breakdown
- Before implementation (quality gate)
- When reviewing workflow artifacts

**What it analyzes:**
- Consistency between spec, plan, and tasks
- Coverage gaps (missing tasks, unaddressed requirements)
- Feasibility assessment
- Alignment with project constitution

**Example:**

```bash
# Analyze MySQL service artifacts
/speckit.analyze

# Result: Identifies:
# - Coverage gaps (no accessibility testing tasks)
# - Consistency issues (task mentions component not in plan)
# - Recommendations (add RTL support tasks)
```

### Phase 7: Quality Checklist (`/speckit.checklist`)

Generate custom quality checklists for validation:

**When to use:**
- Before planning (validate specification)
- Before implementation (validate plan and tasks)
- When reviewing requirements

**What it checks:**
- Requirements completeness
- Clarity and specificity
- Consistency
- Testability

**Example:**

```bash
# Generate quality checklist
/speckit.checklist

# Result: Creates checklist with:
# - All requirements are measurable
# - Success criteria defined
# - No contradictions
# - Aligns with project constitution
# - Action items for improvements
```

### Phase 8: Implementation (`/speckit.implement`)

Execute all tasks to build the feature:

**When to use:**
- After planning, tasks, and analysis are complete
- When ready to write code
- After quality checklist passes

**What it does:**
- Executes all tasks in task list
- Follows dependencies and critical path
- Creates/modifies files
- Writes tests and documentation
- Verifies implementation against requirements

**Example:**

```bash
# Implement MySQL service
/speckit.implement

# Result:
# - Creates service component structure
# - Implements all tabs
# - Adds tRPC integration
# - Writes tests
# - Updates routes
# - Verifies functionality
```

## Process / Workflow

### Complete Spec-Driven Development Flow

```
1. Initialize (first time only)
   specify init . --ai claude --force

2. Constitution (define principles)
   /speckit.constitution

3. Specification (define what to build)
   /speckit.specify

4. Clarification (resolve gaps)
   /speckit.clarify

5. Planning (define how to build)
   /speckit.plan

6. Task Breakdown (create actionable steps)
   /speckit.tasks

7. Analysis (validate consistency)
   /speckit.analyze

8. Quality Checklist (validate completeness)
   /speckit.checklist

9. Implementation (build feature)
   /speckit.implement
```

### ServerlessBase-Specific Workflow

For ServerlessBase projects, the workflow includes additional constraints:

```bash
# 1. Initialize with existing project structure
specify init . --ai claude --force

# 2. Constitution includes ServerlessBase principles
/speckit.constitution

# 3. Specification for ServerlessBase feature
/speckit.specify I want to add [feature] to the ServerlessBase dashboard...

# 4. Clarification for Docker-only development
/speckit.clarify

# 5. Planning with existing tech stack
/speckit.plan The feature uses ServerlessBase tech stack: React 18, TypeScript, TanStack Router, TanStack Query, Shadcn UI, tRPC API...

# 6. Task breakdown following patterns
/speckit.tasks

# 7. Analysis with constitution validation
/speckit.analyze

# 8. Quality checklist for ServerlessBase
/speckit.checklist

# 9. Implementation with Docker-only policy
/speckit.implement

# 10. Verify Docker-only compliance
make shell-client npm run lint
make shell-client npm run typecheck
```

## Guidelines

### Phase 0: Initialization Guidelines

- **Always use `--ai claude`** for Claude Code compatibility
- **Use `--force`** when initializing in non-empty directory
- **Skip git initialization** if project already has git: `--no-git`

### Phase 1: Constitution Guidelines

**Include these principles:**
- Docker-only development policy
- RTL support requirements (for Arabic interface)
- Design differentiation from ServerlessBase main app
- tRPC API integration patterns
- Service component structure
- Shadcn UI compliance

### Phase 2: Specification Guidelines

**Do:**
- Focus on problem space, not solution space
- Include user stories with acceptance criteria
- Specify non-functional requirements
- Define success criteria
- Think about edge cases

**Don't:**
- Specify technologies or implementation details
- Make assumptions about solutions
- Skip non-functional requirements

### Phase 3: Clarification Guidelines

**Always clarify:**
- Edge cases and error handling
- Empty states and loading states
- Integration points
- Boundary conditions
- User experience details

### Phase 4: Planning Guidelines

**For ServerlessBase projects:**
- Match existing tech stack (React 18, TypeScript, TanStack, Shadcn UI)
- Follow service component patterns
- Use tRPC for API integration
- Implement Docker-only development
- Follow RTL support rules
- Use semantic Tailwind tokens for dark mode

### Phase 5: Task Breakdown Guidelines

**Best practices:**
- Break tasks into completable chunks (< 2 hours)
- Group related tasks together
- Identify parallelizable tasks
- Include testing tasks, not just implementation
- Reference existing code patterns

### Phase 6: Analysis Guidelines

**Check for:**
- Consistency between spec, plan, tasks
- Coverage gaps (missing requirements, unaddressed stories)
- Alignment with project constitution
- Feasibility and realistic estimates

### Phase 7: Quality Checklist Guidelines

**Validate:**
- Requirements completeness
- Clarity and specificity
- No contradictions
- Testability
- Alignment with constitution

### Phase 8: Implementation Guidelines

**ServerlessBase-specific:**
- **Docker-only execution**: All commands via Docker containers
- **Use make commands**: `make shell-client`, `make start`, etc.
- **Type checking**: Run `npm run typecheck` in container
- **Linting**: Run `npm run lint` in container
- **Testing**: Write and run tests

## Examples

### Example 1: Complete Workflow - Add PostgreSQL Monitoring

```bash
# 1. Initialize (already done)
specify init . --ai claude --force

# 2. Constitution (already exists)
/speckit.constitution

# 3. Specification
/speckit.specify I want to add real-time monitoring to PostgreSQL database services in the ServerlessBase dashboard. Users should see CPU usage, memory usage, active connections, and query performance metrics displayed in charts. Metrics should update in real-time and users should be able to select time ranges for historical data.

# 4. Clarification
/speckit.clarify
# Answer: Update frequency: 5 seconds, time ranges: 1h, 6h, 24h, 7d

# 5. Planning
/speckit.plan The feature uses Recharts for charting, TanStack Query for data fetching, and tRPC for API integration. Charts follow existing monitoring patterns. Data is fetched via existing monitoring router in ServerlessBase API.

# 6. Task Breakdown
/speckit.tasks
# Tasks: 8 tasks including chart creation, data fetching, time range selector, integration

# 7. Analysis
/speckit.analyze
# Result: No gaps found, all requirements covered

# 8. Quality Checklist
/speckit.checklist
# Result: All checks passed

# 9. Implementation
/speckit.implement
# Creates monitoring charts, integrates with API, adds time range selector

# 10. Verification
make shell-client npm run typecheck
make shell-client npm run lint
make shell-client npm test
```

### Example 2: Iterative Development - Enhance Deployment Logs

```bash
# 1. Specification (incremental feature)
/speckit.specify I want to enhance deployment logs with syntax highlighting for logs that contain code or error messages. Users should be able to filter logs by level (INFO, WARN, ERROR) and search within logs.

# 2. Clarification
/speckit.clarify
# Answer: Syntax highlighting for JSON/YAML, filter defaults to all levels

# 3. Planning
/speckit.plan Uses existing log viewer component, adds highlighting library (Shiki), implements filter UI with Shadcn UI components, search uses regex.

# 4. Task Breakdown
/speckit.tasks
# Tasks: 5 tasks including syntax highlighting, filter UI, search functionality

# 5. Implementation
/speckit.implement

# 6. Testing
make shell-client npm test -- logs
```

### Example 3: Greenfield Feature - Redis Service

```bash
# 1. Specification
/speckit.specify I want to add a Redis cache service to the ServerlessBase dashboard. Users should be able to create, start, stop, and monitor Redis instances. They should see memory usage, connected clients, and command statistics. Users should be able to flush the cache and view real-time commands.

# 2. Clarification
/speckit.clarify
# Answer: Flush requires confirmation, commands shown in real-time with rate limit

# 3. Planning
/speckit.plan Follows existing database service pattern with tabs: general, environment, logs, monitoring, advanced. Uses Shadcn UI components. Monitors via Redis INFO command.

# 4. Task Breakdown
/speckit.tasks
# Tasks: 10 tasks including service structure, tabs, tRPC integration, monitoring

# 5. Analysis
/speckit.analyze
# Result: Added task for Redis-specific error handling

# 6. Quality Checklist
/speckit.checklist
# Result: Passes all checks

# 7. Implementation
/speckit.implement

# 8. Verification
make shell-client npm run typecheck
make shell-client npm run lint
```

## Reference Files

- [📋 Complete Spec Kit Documentation](https://github.com/github/spec-kit) - Official Spec Kit documentation
- [📖 Spec-Driven Development Methodology](./references/methodology.md) - Deep dive into the full process
- [🔧 ServerlessBase Service Patterns](../../../rules/service-component-patterns.md) - Service component structure
- [🐳 Docker Development Rules](../../../rules/docker-development-only.md) - Docker-only development policy
- [🌐 RTL Support Rules](../../../rules/rtl-support-arabic.md) - Arabic RTL support
- [🔗 tRPC API Patterns](../../../rules/trpc-api-patterns.md) - tRPC integration patterns

## Troubleshooting

**Problem**: Spec Kit CLI not found
**Solution**:
1. Install via `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
2. Verify installation with `specify --version`
3. Check uv is in your PATH

**Problem**: Specification too vague
**Solution**:
1. Run `/speckit.clarify` to identify gaps
2. Add more specific user stories with acceptance criteria
3. Include non-functional requirements
4. Define success criteria

**Problem**: Tasks don't match plan
**Solution**:
1. Run `/speckit.analyze` to identify inconsistencies
2. Update plan or tasks to align
3. Check for missing or extra features
4. Verify all requirements are covered

**Problem**: Implementation fails Docker-only policy
**Solution**:
1. Review Docker development rules in `rules/docker-development-only.md`
2. Use `make shell-*` commands for container access
3. Never run npm commands on host machine
4. Run commands like: `make shell-client npm run lint`

**Problem**: RTL support missing
**Solution**:
1. Review RTL support rules in `rules/rtl-support-arabic.md`
2. Use logical properties (`ms-`, `me-`, `ps-`, `pe-`)
3. Mirror directional icons with `rtl:scale-x-[-1]`
4. Test with Arabic locale

**Problem**: Constitution not followed
**Solution**:
1. Run `/speckit.analyze` to check constitution alignment
2. Update constitution if outdated
3. Add tasks to fix non-compliant code
4. Verify all constitution principles are addressed

**Problem**: Quality checklist fails
**Solution**:
1. Review failing checklist items
2. Update specification to address gaps
3. Clarify ambiguous requirements
4. Define acceptance criteria for user stories

**Problem**: Tests fail after implementation
**Solution**:
1. Check test error messages
2. Verify test coverage matches requirements
3. Update tests if requirements changed
4. Ensure all edge cases are tested
