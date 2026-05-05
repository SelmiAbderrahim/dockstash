# Spec-Driven Development Guide

## Philosophy

Spec-Driven Development (SDD) is a paradigm shift from code-first to spec-first development. Instead of treating specifications as disposable scaffolding, SDD treats specifications as **executable artifacts** that directly drive implementation.

## Core Principles

### 1. Intent-Driven Development
- Define **what** to build and **why**, not **how** to build it
- Separation of concerns: requirements vs. implementation
- Specifications guide AI, not the other way around

### 2. Multi-Step Refinement
- One-shot code generation is insufficient
- Iterative refinement through phases: constitution → specify → clarify → plan → tasks → implement
- Each phase adds detail and precision

### 3. Rich Specification Creation
- Use guardrails and organizational principles
- Structured approach to requirements engineering
- Quality validation before implementation

### 4. Technology Independence
- Process not tied to specific technologies
- Validate hypothesis: SDD works with diverse tech stacks
- Adapt to enterprise constraints

## When to Use Spec-Driven Development

### Greenfield Development (0-to-1)
**Best for:**
- New applications or features
- Exploratory projects
- Creative problem-solving

**Workflow:**
1. Start with high-level requirements
2. Generate specifications
3. Plan implementation steps
4. Build production-ready applications

### Iterative Enhancement (Brownfield)
**Best for:**
- Adding features to existing systems
- Modernizing legacy code
- Continuous improvement

**Workflow:**
1. Understand existing context
2. Specify incremental changes
3. Plan integration points
4. Implement with minimal disruption

### Parallel Implementation Exploration
**Best for:**
- Technology comparison
- Proof of concepts
- Creative exploration

**Workflow:**
1. Create single specification
2. Generate multiple plans (different tech stacks)
3. Implement in parallel
4. Compare and select best approach

## Phase-by-Phase Deep Dive

### Phase 0: Initialize Spec Kit

**Purpose**: Set up project structure for specification-driven development.

**Actions:**
```bash
specify init . --ai claude --force
```

**What it creates:**
- `.spec/` directory for specifications
- Constitution template
- Project metadata

**When to run:**
- First time using Spec Kit in a project
- When resetting specification structure

### Phase 1: Constitution

**Purpose**: Establish governing principles that guide all subsequent development.

**Key Elements:**

1. **Quality Standards**
   - Code quality requirements
   - Testing standards
   - Performance expectations
   - Accessibility requirements

2. **Technical Constraints**
   - Tech stack preferences
   - Architecture patterns
   - Security standards
   - Tooling requirements

3. **Development Workflow**
   - Code review process
   - Testing workflow
   - Documentation standards
   - Deployment practices

4. **Project-Specific Rules**
   - Design system compliance
   - Platform-specific constraints
   - Integration patterns
   - Naming conventions

**Example Constitution Elements:**

```markdown
## Quality Standards
- All components must be tested with 80%+ coverage
- TypeScript strict mode enforced
- Accessibility: WCAG 2.1 AA compliant
- Performance: Lighthouse score 90+

## Technical Constraints
- Use React 18 with TypeScript 5+
- State management via TanStack Query
- Styling with Tailwind CSS + Shadcn UI
- API communication via tRPC

## Development Workflow
- PR reviews required for all changes
- CI/CD pipeline must pass
- Documentation required for public APIs
- Docker-only development

## Project-Specific Rules
- RTL support mandatory for Arabic
- Design differentiation from main app
- Service components follow tab structure
- Single .env file policy
```

**Tips:**
- Be specific, not vague
- Include measurable criteria
- Reference existing standards
- Document exceptions

### Phase 2: Specification

**Purpose**: Define requirements and user stories, focusing on problem space.

**Structure:**

1. **Problem Statement**
   - What problem are you solving?
   - Who is this for?
   - Why is this important?

2. **User Stories**
   - As a [user type], I want [feature] so that [benefit]
   - Acceptance criteria for each story

3. **Functional Requirements**
   - System capabilities
   - Input/output specifications
   - Feature interactions

4. **Non-Functional Requirements**
   - Performance
   - Security
   - Scalability
   - Reliability

5. **Success Criteria**
   - Measurable outcomes
   - User acceptance tests
   - Performance benchmarks

**Writing Effective Specifications:**

✅ **DO:**
- Focus on user needs and business value
- Use specific, measurable language
- Include edge cases and error scenarios
- Define acceptance criteria
- Keep implementation-agnostic

❌ **DON'T:**
- Specify technologies or libraries
- Make assumptions about solutions
- Use vague or ambiguous language
- Skip non-functional requirements
- Mix solution space with problem space

**Example:**

```markdown
## Problem Statement
Users need to manage multiple PostgreSQL databases in the ServerlessBase dashboard, but currently they can only create and delete databases without monitoring or configuration options.

## User Stories
As a developer, I want to monitor PostgreSQL performance so that I can optimize queries and identify bottlenecks.
- Acceptance: CPU, memory, and connection metrics displayed
- Acceptance: Real-time updates every 5 seconds
- Acceptance: Historical data for last 24 hours

As a devops engineer, I want to configure PostgreSQL settings so that I can tune performance for different workloads.
- Acceptance: Edit postgresql.conf settings
- Acceptance: Restart required settings flagged
- Acceptance: Settings validation

## Functional Requirements
- Display real-time metrics: CPU usage, memory usage, active connections
- Provide configuration editor for PostgreSQL settings
- Support start/stop/restart operations
- Generate connection strings with credentials

## Non-Functional Requirements
- Performance: Metrics update within 500ms
- Security: Credentials masked in UI
- Scalability: Support monitoring up to 100 databases
- Reliability: Handle connection timeouts gracefully

## Success Criteria
- 95% of users report metrics accuracy > 90%
- Average configuration time < 2 minutes
- Zero data leaks in credential management
```

### Phase 3: Clarification

**Purpose**: Identify and resolve gaps, ambiguities, and edge cases.

**What to Clarify:**

1. **Edge Cases**
   - Boundary conditions
   - Invalid inputs
   - Unexpected states

2. **Error Handling**
   - Failure scenarios
   - Error messages
   - Recovery mechanisms

3. **User Experience**
   - Empty states
   - Loading states
   - Error states

4. **Integration Points**
   - API dependencies
   - Data synchronization
   - External services

**Clarification Process:**

1. **Identify Gaps**
   - Review specification for completeness
   - Mark unclear or missing information
   - List assumptions

2. **Ask Questions**
   - Formulate clarifying questions
   - Prioritize by impact
   - Document answers

3. **Update Specification**
   - Add missing details
   - Clarify ambiguous points
   - Remove or document assumptions

**Example Questions:**

```
What happens when:
- PostgreSQL container fails to start?
- Connection to database is lost?
- User enters invalid configuration settings?
- Disk space is full?
- Multiple users configure the same database simultaneously?

How should the system handle:
- Slow database queries?
- Timeouts when fetching metrics?
- Corrupted configuration files?
- Concurrent configuration changes?
```

### Phase 4: Planning

**Purpose**: Create technical implementation plan with chosen tech stack.

**Planning Approach:**

1. **Tech Stack Selection**
   - Match existing project patterns
   - Consider team expertise
   - Evaluate trade-offs
   - Plan for scalability

2. **Architecture Decisions**
   - System architecture (monolith, microservices, etc.)
   - Component hierarchy
   - Data flow
   - State management

3. **Implementation Strategy**
   - Phased development
   - MVP vs. full feature scope
   - Risk mitigation
   - Dependencies

4. **Development Workflow**
   - Testing approach
   - Code organization
   - Documentation
   - Deployment

**Example Plan:**

```markdown
## Tech Stack
- Frontend: React 18, TypeScript 5+, TanStack Router, TanStack Query
- UI: Shadcn UI components, Tailwind CSS
- API: tRPC (existing ServerlessBase integration)
- Charts: Recharts (existing monitoring pattern)
- Icons: Lucide React

## Architecture
- Service component: `client/src/components/dashboard/postgres/`
- Tabs: general, environment, logs, monitoring, backups, advanced
- Data fetching: TanStack Query hooks
- State management: Query cache + URL state for tabs
- API: tRPC `postgres` router

## Implementation Phases
Phase 1: Core Structure
- Create service component directory
- Implement tab structure
- Set up routing

Phase 2: Basic Functionality
- General tab (connection info, credentials)
- Environment tab (variables editor)
- Start/stop/restart actions

Phase 3: Monitoring
- Real-time metrics display
- Historical data charts
- Performance indicators

Phase 4: Advanced Features
- Configuration editor
- Backups management
- Advanced settings

## Testing Strategy
- Unit tests for hooks and services
- Component tests for UI
- Integration tests with mock tRPC API
- E2E tests with Playwright
```

**Tips:**
- Align with existing project architecture
- Reuse components and patterns
- Plan for testing from the start
- Consider deployment requirements

### Phase 5: Task Breakdown

**Purpose**: Convert plan into actionable, prioritized tasks.

**Task Breakdown Principles:**

1. **Task Granularity**
   - Tasks should be completable in < 2 hours
   - Each task has clear acceptance criteria
   - Avoid tasks that are too large or too small

2. **Dependencies**
   - Identify critical path
   - Mark parallelizable tasks
   - Document blocking relationships

3. **Acceptance Criteria**
   - Define "done" for each task
   - Include testing requirements
   - Specify deliverables

4. **Priority**
   - Order by dependency
   - Consider risk mitigation
   - Value delivery sequence

**Example Task Breakdown:**

```markdown
Task 1: Create service component structure [Priority: High, Parallel: Yes]
- Create `client/src/components/dashboard/postgres/` directory
- Create `postgres-header.tsx` (title, status, actions)
- Create tabs subdirectory with 6 tab files
- Acceptance: All files created with basic structure

Task 2: Implement tRPC integration [Priority: High, Parallel: Yes]
- Add hooks to `client/src/hooks/deployment/usePostgres.ts`
- Update `queryKeys.ts` with postgres keys
- Create service in `client/src/services/deployment/postgresService.ts`
- Acceptance: tRPC calls work with mock data

Task 3: Build general tab [Priority: Medium, Depends: 1,2]
- Display connection details (host, port, database)
- Show credentials management
- Add start/stop/restart buttons
- Acceptance: Tab displays data, actions work

Task 4: Build monitoring tab [Priority: Medium, Depends: 1,2]
- Create CPU usage chart with Recharts
- Create memory usage chart
- Create connections chart
- Acceptance: Charts display real-time data

[... additional tasks ...]
```

### Phase 6: Analysis

**Purpose**: Validate consistency and coverage across all artifacts.

**Analysis Checklist:**

1. **Consistency**
   - [ ] Tasks match plan?
   - [ ] Plan addresses all requirements?
   - [ ] No contradictions between artifacts?
   - [ ] Terminology consistent across artifacts?

2. **Coverage**
   - [ ] All requirements covered by tasks?
   - [ ] All user stories addressed?
   - [ ] Non-functional requirements addressed?
   - [ ] Edge cases handled?

3. **Feasibility**
   - [ ] Task breakdown realistic?
   - [ ] Dependencies clear?
   - [ ] Estimates reasonable?
   - [ ] Resources available?

4. **Constitution Alignment**
   - [ ] Follows Docker-only policy?
   - [ ] RTL support included (if needed)?
   - [ ] Testing standards met?
   - [ ] Code quality standards satisfied?

**Common Issues Found:**

- **Coverage Gaps**: Missing tasks for testing, documentation, or edge cases
- **Consistency Issues**: Task mentions component not in plan, or vice versa
- **Feasibility Concerns**: Tasks too large, dependencies unclear
- **Constitution Violations**: Skipping testing, not following patterns

### Phase 7: Quality Checklist

**Purpose**: Validate requirements completeness, clarity, and consistency.

**Quality Criteria:**

1. **Completeness**
   - All user stories defined
   - Acceptance criteria clear
   - Non-functional requirements specified
   - Success criteria defined

2. **Clarity**
   - Requirements measurable
   - Terms defined
   - Scope bounded
   - Assumptions stated

3. **Consistency**
   - No contradictions
   - Terminology consistent
   - Aligns with constitution
   - Dependencies clear

4. **Testability**
   - Each requirement testable
   - Success criteria defined
   - Acceptance criteria verifiable

**Example Checklist:**

```
Specification Quality Checklist

Completeness:
✓ User stories defined (4 stories)
✓ Acceptance criteria for each story
✓ Functional requirements listed
✓ Non-functional requirements specified
✗ Success criteria incomplete (add metrics)

Clarity:
✓ Requirements are measurable
✓ Terms are defined
✓ Scope is bounded
✓ Assumptions are stated
✗ "Optimize queries" - vague, need specific metrics

Consistency:
✓ No contradictions found
✓ Terminology consistent
✓ Aligns with constitution
✓ Dependencies identified

Testability:
✓ All requirements are testable
✓ Success criteria defined (partially)
✓ Acceptance criteria verifiable

Action Items:
1. Add specific success criteria for query optimization (e.g., "95% of queries complete in < 100ms")
2. Clarify "optimize queries" with specific performance targets
```

### Phase 8: Implementation

**Purpose**: Execute all tasks to build the feature.

**Execution Strategy:**

1. **Concurrent Execution**
   - Execute parallel tasks simultaneously
   - Respect dependencies
   - Follow critical path

2. **Docker-Only Policy**
   - All commands run in containers
   - Use `make shell-*` commands
   - Never run on host machine

3. **Quality Gates**
   - Type check after TypeScript changes
   - Lint check after implementation
   - Test after features complete

4. **Verification**
   - Verify against requirements
   - Test user stories
   - Check constitution compliance

**Execution Flow:**

```bash
# Task 1 & 2 (parallel)
- Create service component structure
- Implement tRPC integration

# Tasks 3-8 (sequential or parallel based on dependencies)
- Build tabs
- Add routing
- Write tests
- Verify functionality

# Quality checks
make shell-client npm run typecheck
make shell-client npm run lint
make shell-client npm test

# Verification
- All requirements met
- User stories pass
- Constitution compliant
```

## Best Practices

### For Specifications

- **Be Specific**: Use numbers, percentages, concrete examples
- **Think Like a Tester**: How will you verify each requirement?
- **Include Edge Cases**: What happens when things go wrong?
- **Define Done**: When is a feature "complete"?

### For Planning

- **Reuse Patterns**: Don't reinvent the wheel
- **Plan for Testing**: Tests are tasks, not afterthoughts
- **Consider Operations**: How will you deploy and monitor?
- **Think About Iteration**: What's the MVP vs. full feature?

### For Implementation

- **Follow Constitution**: Don't violate established principles
- **Test Continuously**: Write tests as you implement
- **Refactor Early**: Don't let technical debt accumulate
- **Document Decisions**: Why did you choose this approach?

### For Teams

- **Review Specifications**: Get stakeholder input early
- **Collaborate on Plans**: Multiple perspectives catch issues
- **Share Patterns**: Reuse successful approaches
- **Learn from Failures**: Document what didn't work

## Common Pitfalls

### Specification Phase

❌ **Vague Requirements**: "Make it fast" vs. "95% of API calls complete in < 100ms"
❌ **Skipping Edge Cases**: Forgetting about empty states, timeouts, errors
❌ **Mixing Solution Space**: Specifying React components instead of user needs
❌ **Ignoring Non-Functional**: Focusing only on features, forgetting performance, security

### Planning Phase

❌ **Over-Engineering**: Building complex architecture for simple features
❌ **Under-Engineering**: Ignoring scalability for future growth
❌ **Ignoring Constraints**: Not considering team expertise, timeline, resources
❌ **Skipping Tests**: Planning to add tests "later" (they never get added)

### Implementation Phase

❌ **Skipping Constitution**: Violating established patterns and rules
❌ **No Testing**: Implementing without verification
❌ **Host Machine Commands**: Running npm directly instead of in Docker
❌ **Ignoring Errors**: Continuing when tests fail

## Advanced Topics

### Parallel Implementation Exploration

Generate multiple technical plans from a single specification:

1. **Create specification** (once)
2. **Generate Plan A**: React + TanStack Query + tRPC
3. **Generate Plan B**: Svelte + SvelteKit + GraphQL
4. **Implement both**: Execute both task lists
5. **Compare**: Evaluate based on performance, maintainability, team fit

### Enterprise Constraint Integration

Incorporate organizational constraints:

1. **Cloud Provider**: AWS, GCP, Azure requirements
2. **Security**: SOC2, HIPAA compliance
3. **Tech Stack**: Approved libraries and frameworks
4. **Design System**: Enterprise UI components
5. **Engineering Practices**: Code review, CI/CD pipelines

Add these to your constitution:
```markdown
## Enterprise Constraints
- Cloud provider: AWS (us-east-1)
- Security: SOC2 Type II compliant
- Approved libraries: Only from npm-internal registry
- Design system: Enterprise Component Library v2.1
- Code review: Required for all changes
- CI/CD: Must pass security scans
```

### Iterative Brownfield Development

Add features to existing systems:

1. **Understand Context**: Analyze existing code, architecture, patterns
2. **Specify Incremental Change**: Focus on new functionality, not rewriting
3. **Plan Integration**: How new feature connects to existing system
4. **Implement with Care**: Minimize disruption, maintain compatibility
5. **Regression Testing**: Ensure existing features still work

## Summary

Spec-Driven Development is a **process**, not a tool. The key is to:
- Think clearly about **what** to build (specification)
- Plan carefully about **how** to build it (plan)
- Break down into **actionable tasks** (tasks)
- Implement with **quality and consistency** (implement)
- **Validate** every step along the way (analyze, checklist)

By following this methodology, you'll build better software faster, with fewer rewrites and higher quality.
