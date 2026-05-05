# Spec-Driven Development Patterns

This document covers advanced patterns for Spec-Driven Development, covering edge cases, optimization strategies, and specialized scenarios for ServerlessBase and similar projects.

## Core Patterns

### 1. Progressive Elaboration Pattern

Gradually add detail to specifications through multiple phases, avoiding premature optimization.

**Problem:** Starting with too much detail leads to analysis paralysis.

**Solution:** Begin with high-level requirements, progressively elaborate through phases.

**Example:**

```markdown
# Phase 1: High-Level (Specification)
User can manage PostgreSQL databases with monitoring and configuration.

# Phase 2: Detailed (Clarification)
User can create, start, stop, configure, and monitor PostgreSQL databases.
Monitoring includes: CPU, memory, connections, query performance.
Configuration includes: settings editor, restart policies, port mapping.

# Phase 3: Technical (Plan)
PostgreSQL service with tabs: general, environment, logs, monitoring, advanced.
Monitoring via Recharts, real-time updates every 5 seconds.
Configuration via postgresql.conf editor with validation.

# Phase 4: Implementation (Tasks)
Task 1: Create service structure, Task 2: tRPC integration, ...
```

### 2. Constraint-First Pattern

Start with project constraints and limitations before defining features.

**Problem:** Defining features without considering constraints leads to impossible implementations.

**Solution:** Document all constraints in constitution before specification.

**Example:**

```markdown
## Constitution Constraints
- Docker-only development
- RTL support for Arabic
- Design differentiation from main app
- Single .env file policy
- tRPC API only (no REST)

## Specification (within constraints)
User can manage PostgreSQL databases via tRPC API interface.
Monitoring displays CPU/memory metrics with Recharts.
RTL support: charts flip direction in Arabic locale.
Design: Different layout than main app (sidebar vs top-nav).
```

### 3. Test-Driven Requirements Pattern

Write requirements with testability in mind from the start.

**Problem:** Vague requirements lead to untestable implementations.

**Solution:** Define acceptance criteria as verifiable statements.

**Example:**

```markdown
# Untestable Requirement
User can see database performance metrics.

# Testable Requirement
User can view real-time CPU and memory usage for each PostgreSQL database.
- CPU usage displays as percentage (0-100%)
- Memory usage displays in MB with precision to 2 decimal places
- Metrics update every 5 seconds with ±500ms tolerance
- Metrics display within 500ms of page load

# Acceptance Test
Given: User has PostgreSQL database "db1"
When: User navigates to database monitoring tab
Then: CPU usage displays (e.g., "45%")
And: Memory usage displays (e.g., "512.34 MB")
And: Values update within 5 seconds
```

## ServerlessBase-Specific Patterns

### 4. Service Component Pattern

Follow established tab structure for database and application services.

**Pattern:**

```markdown
## Tab Structure (Standard Order)
1. General - Connection info, credentials, status
2. Environment - Environment variables editor
3. Logs - Real-time log viewer
4. Monitoring - CPU/memory charts
5. Backups - Backup/restore (if applicable)
6. Advanced - Resource limits, ports

## File Structure
client/src/components/dashboard/{service}/
├── {service}-header.tsx          # Title, status badge, actions
└── tabs/
    ├── general-tab.tsx
    ├── environment-tab.tsx
    ├── logs-tab.tsx
    ├── monitoring-tab.tsx
    ├── backups-tab.tsx              # Optional
    └── advanced-tab.tsx
```

### 5. tRPC Integration Pattern

Follow existing tRPC client patterns for API communication.

**Pattern:**

```markdown
## tRPC Client Structure
# Service
client/src/services/deployment/{service}Service.ts
export const {Service}Service = {
  async getById(id: string): Promise<{Service}> {
    return trpcQuery<{Service}>('{service}', 'one', { {service}Id: id });
  },
  async start(id: string): Promise<void> {
    return trpcMutation<void>('{service}', 'start', { {service}Id: id });
  },
};

# Hooks
client/src/hooks/deployment/use{Service}.ts
export const use{Service} = (id: string) => {
  return useQuery({
    queryKey: deploymentKeys.databases.{service}.detail(id),
    queryFn: () => {Service}Service.getById(id),
  });
};

# Query Keys
deploymentKeys.databases.{service}.lists()      // [{deployment}, {databases}, {service}, list]
deploymentKeys.databases.{service}.detail(id)   // [{deployment}, {databases}, {service}, detail, id]
deploymentKeys.databases.{service}.logs(id)     // [{deployment}, {databases}, {service}, logs, id]
```

### 6. Docker-Only Development Pattern

All development commands must run through Docker containers.

**Pattern:**

```markdown
## Forbidden Commands (NEVER use)
❌ cd client && npm install
❌ cd client && npm run dev
❌ node script.js
❌ psql -h localhost -U postgres

## Required Commands (ALWAYS use)
✅ make shell-client npm install
✅ make start (or docker-compose up -d)
✅ make shell-client node script.js
✅ make shell-postgres psql -h localhost -U postgres

## Implementation Tasks Must Include:
- [ ] Create file using Write tool (runs in container context)
- [ ] Run linting: make shell-client npm run lint
- [ ] Run typecheck: make shell-client npm run typecheck
- [ ] Run tests: make shell-client npm test
```

### 7. RTL Support Pattern

Ensure all UI components support Arabic RTL layout.

**Pattern:**

```markdown
## RTL Requirements
- Use logical properties: ms-, me-, ps-, pe-, start-, end-
- Use flex-row with rtl:flex-row-reverse for directional content
- Mirror directional icons with rtl:scale-x-[-1]

## Implementation Checklist
- [ ] Replace ml-* with ms-*
- [ ] Replace mr-* with me-*
- [ ] Replace pl-* with ps-*
- [ ] Replace pr-* with pe-*
- [ ] Add rtl:flex-row-reverse to flex-row containers with directional content
- [ ] Add rtl:scale-x-[-1] to ArrowRight, ChevronRight icons
- [ ] Test with Arabic locale (ar-SA)

## Example
<div className="flex flex-row rtl:flex-row-reverse items-center justify-between">
  <h2 className="text-start">Title</h2>
  <ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
</div>
```

## Anti-Patterns

### 8. Implementation-Specific Specifications

**Problem:** Specifying technologies or implementation details in requirements.

**Anti-Pattern:**
```markdown
# WRONG - Implementation-specific
User can manage PostgreSQL using Shadcn UI components and Recharts for monitoring.
```

**Correct Pattern:**
```markdown
# CORRECT - Implementation-agnostic
User can manage PostgreSQL databases with real-time monitoring of CPU and memory usage.
```

### 9. Single-Task Giant

**Problem:** Creating tasks that are too large to complete in one session.

**Anti-Pattern:**
```markdown
# WRONG - Too large
Task 1: Implement complete PostgreSQL service with all tabs, monitoring, and testing.
```

**Correct Pattern:**
```markdown
# CORRECT - Break down
Task 1: Create service component structure (directory, header, tab files)
Task 2: Implement tRPC integration (hooks, services, query keys)
Task 3: Build general tab (connection info, credentials, actions)
Task 4: Build environment tab (variables editor)
[... continue with individual tabs ...]
```

### 10. Missing Edge Cases

**Problem:** Forgetting about error states, empty states, and boundary conditions.

**Anti-Pattern:**
```markdown
# WRONG - Only happy path
User can view database metrics.
```

**Correct Pattern:**
```markdown
# CORRECT - Includes edge cases
User can view database metrics.
- Metrics display when database is running
- Empty state when database is stopped: "Database is not running"
- Error state when metrics unavailable: "Unable to fetch metrics"
- Loading state while fetching: "Loading metrics..."
```

## Advanced Patterns

### 11. Parallel Implementation Pattern

Generate multiple technical approaches from a single specification.

**Pattern:**

```markdown
## Specification (Single)
User can manage PostgreSQL databases with monitoring.

## Plan A (React + TanStack + tRPC)
Tech Stack: React 18, TanStack Query, tRPC, Shadcn UI
Architecture: Service component with tabs, query hooks
Tasks: 10 tasks, ~16 hours total

## Plan B (Svelte + SvelteKit + GraphQL)
Tech Stack: Svelte 4, SvelteKit, GraphQL, Svelte UI
Architecture: Page-based routing, GraphQL queries
Tasks: 8 tasks, ~14 hours total

## Execute
/speckit.tasks (Plan A)
/speckit.implement (Plan A)

# Later, if needed:
/speckit.tasks (Plan B)
/speckit.implement (Plan B)

## Compare
- Plan A: Better integration with existing system, more maintainable
- Plan B: Smaller bundle size, better performance
```

### 12. Incremental Rollout Pattern

Plan for phased feature rollout with feature flags.

**Pattern:**

```markdown
## Specification
User can manage PostgreSQL databases with AI-powered query optimization.

## Plan with Feature Flags
Phase 1 (MVP):
- Database management (CRUD)
- Basic monitoring (CPU, memory)
- Configuration editor

Phase 2 (Feature Flag: AI_OPTIMIZATION_ENABLED):
- AI query optimization suggestions
- Performance insights
- Query anomaly detection

Phase 3 (Feature Flag: ADVANCED_MONITORING):
- Query performance charts
- Slow query analysis
- Index recommendations

## Implementation Tasks
Task 1: Implement Phase 1 features
Task 2: Add feature flag infrastructure
Task 3: Implement Phase 2 features (behind flag)
Task 4: Implement Phase 3 features (behind flag)
```

### 13. Legacy Integration Pattern

Add features to existing systems while minimizing disruption.

**Pattern:**

```markdown
## Specification
Add real-time monitoring to existing PostgreSQL service.

## Existing Context Analysis
- Current: PostgreSQL service with basic info display
- Architecture: Service component with tabs (general, environment)
- Data: tRPC router with basic endpoints

## Integration Plan
Phase 1: Add monitoring tab (non-breaking)
- Create `monitoring-tab.tsx` (new file)
- Add new tRPC endpoints for metrics
- Update tab navigation (add monitoring)

Phase 2: Enhance existing tabs (careful changes)
- Add status indicator to general tab (non-breaking enhancement)
- Add quick actions to header (non-breaking enhancement)

Phase 3: Refactor (if needed, separate iteration)
- Extract shared components
- Optimize tRPC queries
- Improve caching strategy

## Regression Testing
- [ ] Test existing general tab functionality
- [ ] Test existing environment tab functionality
- [ ] Test navigation between tabs
- [ ] Test existing start/stop/restart actions
```

## Quality Patterns

### 14. Definition of Done Pattern

Establish clear "done" criteria for tasks and features.

**Pattern:**

```markdown
## Task Definition of Done
For each task:
- [ ] Code written and functional
- [ ] TypeScript compiles without errors
- [ ] Linting passes (no warnings)
- [ ] Unit tests written and passing
- [ ] Code reviewed (if applicable)
- [ ] Documentation updated

## Feature Definition of Done
For each feature:
- [ ] All tasks complete (as per task DoD)
- [ ] User stories pass acceptance tests
- [ ] Non-functional requirements met
- [ ] Performance benchmarks achieved
- [ ] Accessibility requirements satisfied
- [ ] Security requirements validated
- [ ] Documentation complete

## Example: PostgreSQL Monitoring Feature
Task DoD:
Task 3 (Build monitoring tab):
✓ CPU chart displays real-time data
✓ Memory chart displays real-time data
✓ Charts update every 5 seconds (±500ms)
✓ TypeScript compiles
✓ Linting passes
✓ Unit tests for chart components pass

Feature DoD:
✓ All 10 tasks complete
✓ User story: "As a developer, I want to monitor PostgreSQL performance" - PASS
✓ Performance: Metrics update within 500ms - PASS
✓ Accessibility: Charts meet WCAG 2.1 AA - PASS
✓ RTL: Charts flip direction in Arabic - PASS
```

### 15. Continuous Validation Pattern

Validate artifacts throughout development, not just at the end.

**Pattern:**

```markdown
## Validation Checkpoints

After Specification:
- [ ] /speckit.clarify - No major gaps
- [ ] All user stories have acceptance criteria
- [ ] Non-functional requirements defined

After Planning:
- [ ] Tech stack matches existing patterns
- [ ] Architecture follows project constitution
- [ ] Integration points identified

After Task Breakdown:
- [ ] All tasks have clear acceptance criteria
- [ ] Tasks are completable in < 2 hours
- [ ] Dependencies documented

During Implementation:
- [ ] Each task passes TypeScript typecheck
- [ ] Each task passes linting
- [ ] Tests written for each task

After Implementation:
- [ ] /speckit.analyze - No consistency issues
- [ ] /speckit.checklist - All quality checks pass
- [ ] All requirements met
- [ ] Constitution compliance verified
```

## Troubleshooting Patterns

### 16. Specification Refactoring Pattern

When requirements change mid-development.

**Pattern:**

```markdown
## Scenario: New Requirement Discovered

Current Specification:
User can monitor PostgreSQL databases (CPU, memory, connections).

New Requirement:
Users want to monitor query execution time and slow queries.

## Refactoring Process
1. Update Specification
   - Add new user story for query monitoring
   - Add acceptance criteria
   - Update success criteria

2. Run /speckit.clarify
   - Identify what "slow query" means
   - Determine time thresholds

3. Update Plan
   - Add query monitoring to plan
   - Identify integration points with existing monitoring

4. Update Tasks
   - Add new tasks for query monitoring
   - Mark dependencies with existing tasks

5. Run /speckit.analyze
   - Check consistency across updated artifacts
   - Identify new coverage gaps

6. Continue Implementation
   - Execute new tasks
   - Update existing tasks if needed
```

### 17. Failure Recovery Pattern

When implementation fails or doesn't meet requirements.

**Pattern:**

```markdown
## Scenario: Implementation Doesn't Meet Performance Requirement

Requirement:
Metrics update every 5 seconds with ±500ms tolerance.

Implementation:
Metrics update every 5-8 seconds (failing tolerance).

## Recovery Process
1. Identify Root Cause
   - Network latency in tRPC calls
   - Chart re-rendering overhead

2. Options Analysis
   Option A: Optimize tRPC queries (add caching)
   Option B: Reduce update frequency to 10 seconds (change requirement)
   Option C: Implement optimistic updates (show cached data, refresh in background)

3. Update Plan
   - Choose Option C (best user experience)
   - Update architecture with optimistic updates
   - Add task for implementing optimistic updates

4. Update Tasks
   - Add task: "Implement optimistic updates for metrics"
   - Update existing tasks to support optimistic updates

5. Re-implement
   - Execute updated tasks
   - Verify performance requirement met
```

## Summary

Use these patterns to:
- Avoid common pitfalls
- Maintain consistency across projects
- Improve quality of specifications and implementations
- Handle complex scenarios effectively

Remember: Patterns are guidelines, not rules. Adapt them to your specific context and requirements.
