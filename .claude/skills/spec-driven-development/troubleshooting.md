# Spec-Driven Development Troubleshooting

This guide covers common issues and solutions when using Spec-Driven Development with Spec Kit for ServerlessBase projects.

## Installation Issues

### Issue: Spec Kit CLI Not Found

**Symptoms:**
- `specify: command not found` error
- `/speckit.*` commands don't work

**Diagnosis:**
```bash
# Check if specify is installed
which specify

# Check uv installation
which uv
uv --version
```

**Solutions:**

**Solution 1: Install Spec Kit CLI**
```bash
# Install via uv
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Verify installation
specify --version
specify check
```

**Solution 2: Update uv PATH**
```bash
# Add uv tools to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload shell
source ~/.bashrc
# or
source ~/.zshrc

# Verify
which specify
```

**Solution 3: Reinstall Spec Kit**
```bash
# Force reinstall
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git

# Verify
specify --version
```

---

## Specification Issues

### Issue: Specification Too Vague

**Symptoms:**
- `/speckit.plan` struggles to create technical plan
- `/speckit.tasks` generates generic tasks
- `/speckit.clarify` returns many questions

**Diagnosis:**
- Requirements lack specific details
- Missing acceptance criteria
- No success criteria defined
- Ambiguous language

**Solutions:**

**Solution 1: Add Acceptance Criteria**
```markdown
# Vague
User can monitor database performance.

# Specific
User can monitor database performance.
- CPU usage displays as percentage (0-100%)
- Memory usage displays in MB with 2 decimal places
- Metrics update every 5 seconds (±500ms tolerance)
- Metrics display within 500ms of page load
```

**Solution 2: Define Success Criteria**
```markdown
# Add measurable outcomes
## Success Criteria
- 95% of users report metrics accuracy > 90%
- 90% of metrics updates complete in < 500ms
- Zero data loss in credential management
- Lighthouse score 90+ for performance
```

**Solution 3: Run `/speckit.clarify`**
```bash
# Identify gaps
/speckit.clarify

# Answer clarifying questions to add detail
# - What happens when database is stopped?
# - How should system handle connection timeouts?
# - What's the maximum number of databases?
```

---

### Issue: Specification Contains Implementation Details

**Symptoms:**
- Specification mentions React, Shadcn UI, or other technologies
- `/speckit.plan` struggles with technology choices
- Task breakdown focuses on specific libraries

**Diagnosis:**
- Mixed problem space and solution space
- Premature technology decisions

**Solutions:**

**Solution 1: Refactor Specification**
```markdown
# WRONG - Implementation-specific
User can monitor PostgreSQL using Recharts and Shadcn UI.

# CORRECT - Problem-focused
User can monitor PostgreSQL performance metrics.
View real-time CPU and memory usage for PostgreSQL databases.
```

**Solution 2: Move Details to Plan**
```markdown
# Specification (what to build)
User can monitor PostgreSQL performance metrics.

# Plan (how to build)
## Tech Stack
- Charts: Recharts
- UI: Shadcn UI components
- Data fetching: TanStack Query
```

---

## Planning Issues

### Issue: Plan Doesn't Match Existing Codebase

**Symptoms:**
- Plan suggests technologies not in project
- Architecture doesn't match ServerlessBase patterns
- `/speckit.implement` creates code that doesn't integrate well

**Diagnosis:**
- Plan didn't reference existing patterns
- Ignored project constitution
- Didn't review existing service components

**Solutions:**

**Solution 1: Review Existing Patterns**
```bash
# Check existing database services
ls client/src/components/dashboard/postgres/
ls client/src/components/dashboard/redis/
ls client/src/components/dashboard/mongo/

# Review service component builder
cat .claude/agents/serverlessbase/service-tab-component-builder.md

# Review tRPC patterns
cat .claude/rules/trpc-api-patterns.md
```

**Solution 2: Update Plan to Match Patterns**
```markdown
# Match existing tech stack
## Tech Stack
- Frontend: React 18, TypeScript, TanStack Router (existing)
- State Management: TanStack Query (existing)
- UI: Shadcn UI (existing)
- API: tRPC (existing)
- Charts: Recharts (existing)

# Follow service component pattern
client/src/components/dashboard/mysql/
├── mysql-header.tsx
└── tabs/
    ├── general-tab.tsx
    ├── environment-tab.tsx
    ├── logs-tab.tsx
    ├── monitoring-tab.tsx
    ├── backups-tab.tsx
    └── advanced-tab.tsx
```

**Solution 3: Check Constitution Compliance**
```bash
# Run analysis
/speckit.analyze

# Check for constitution violations
# - Docker-only development?
# - RTL support?
# - Design differentiation?
```

---

### Issue: Tasks Are Too Large or Too Small

**Symptoms:**
- Tasks take > 4 hours to complete
- Tasks are atomic changes (e.g., "Add import statement")
- Task breakdown doesn't flow logically

**Diagnosis:**
- Poor task granularity
- No clear acceptance criteria
- Dependencies unclear

**Solutions:**

**Solution 1: Break Down Large Tasks**
```markdown
# TOO LARGE
Task 1: Implement complete PostgreSQL monitoring with all charts, real-time updates, and testing.

# BETTER - Break down
Task 1: Create monitoring tab structure (directory, component shell)
Task 2: Implement CPU usage chart with Recharts
Task 3: Implement memory usage chart with Recharts
Task 4: Implement connections chart with Recharts
Task 5: Add time range selector (1h, 6h, 24h, 7d)
Task 6: Integrate with tRPC API for metrics
Task 7: Add real-time updates (polling every 5 seconds)
Task 8: Write tests for monitoring components
```

**Solution 2: Merge Small Tasks**
```markdown
# TOO SMALL
Task 1: Create monitoring-tab.tsx file
Task 2: Add import statements to monitoring-tab.tsx
Task 3: Create chart component skeleton

# BETTER - Merge
Task 1: Create monitoring tab structure with chart placeholders
```

**Solution 3: Add Acceptance Criteria**
```markdown
Task 3: Implement CPU usage chart with Recharts
Acceptance Criteria:
- [ ] Chart displays CPU percentage (0-100%)
- [ ] Chart updates every 5 seconds
- [ ] X-axis shows time (last 1 hour)
- [ ] Y-axis shows percentage
- [ ] Hover displays exact value and timestamp
- [ ] Chart handles no data gracefully
- [ ] TypeScript compiles without errors
- [ ] Component passes linting
```

---

## Implementation Issues

### Issue: Docker-Only Development Policy Violation

**Symptoms:**
- Running `npm install` directly on host machine
- Running `node` or `npm` commands without `docker exec`
- Code fails to run in Docker container
- Different behavior on host vs container

**Diagnosis:**
- Forgot Docker-only policy
- Not using `make shell-*` commands

**Solutions:**

**Solution 1: Use Docker Commands**
```bash
# WRONG - Host machine
cd client && npm install
npm run dev
npm run lint

# CORRECT - Docker only
make shell-client npm install
make start
make shell-client npm run lint
```

**Solution 2: Use Makefile Commands**
```bash
# Available make commands
make shell-client    # Access client container
make shell-postgres  # Access PostgreSQL container
make start          # Start all services
make stop           # Stop all services
make logs           # View logs
```

**Solution 3: Check Docker Policy**
```bash
# Review Docker development rules
cat .claude/rules/docker-development-only.md

# Key rules:
# - NEVER run npm commands on host machine
# - ALWAYS use make shell-* commands
# - All operations must run in Docker containers
```

---

### Issue: RTL Support Missing

**Symptoms:**
- Layout breaks in Arabic locale
- Icons don't flip direction
- Margins/padding incorrect in RTL

**Diagnosis:**
- Used physical directional properties (`ml-`, `mr-`, `pl-`, `pr-`)
- Didn't mirror directional icons
- Didn't use `rtl:flex-row-reverse`

**Solutions:**

**Solution 1: Replace Physical with Logical Properties**
```typescript
// WRONG - Physical properties
<div className="ml-4 mr-2 pl-6 pr-4">
  <ArrowRight className="mr-2" />

// CORRECT - Logical properties
<div className="ms-4 me-2 ps-6 pe-4">
  <ArrowRight className="me-2 rtl:scale-x-[-1]" />
```

**Solution 2: Mirror Directional Icons**
```typescript
// Icons that must mirror in RTL:
- ArrowRight, ChevronRight, ArrowLeft, ChevronLeft
- ArrowForward, ArrowBack
- ArrowTop, ArrowBottom

// Add RTL class
<ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
```

**Solution 3: Use RTL Flex Direction**
```typescript
// For containers with directional content
<div className="flex flex-row rtl:flex-row-reverse items-center justify-between">
  <h2>Title</h2>
  <button>Action</button>
</div>
```

**Solution 4: Test with Arabic Locale**
```bash
# Set locale to Arabic (in container)
make shell-client
export NEXT_PUBLIC_LOCALE=ar-SA
npm run dev

# Or test in browser
# Set browser language to Arabic
# Navigate to application
# Check layout direction
```

---

### Issue: Type Checking Fails

**Symptoms:**
- TypeScript compilation errors
- `any` types everywhere
- Missing type definitions

**Diagnosis:**
- TypeScript strict mode violations
- Missing type definitions
- Incorrect type usage

**Solutions:**

**Solution 1: Enable Strict Mode**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Solution 2: Add Type Definitions**
```typescript
// WRONG - No types
const data = await trpcQuery('postgres', 'all');

// CORRECT - With types
interface Postgres {
  id: string;
  name: string;
  status: 'running' | 'stopped';
}

const data = await trpcQuery<Postgres[]>('postgres', 'all');
```

**Solution 3: Fix Type Errors**
```bash
# Run typecheck in Docker
make shell-client npm run typecheck

# Fix reported errors
# - Missing type imports
# - Incorrect type usage
# - Implicit any types
```

---

## Testing Issues

### Issue: Tests Fail After Implementation

**Symptoms:**
- Unit tests fail
- Integration tests fail
- E2E tests fail
- Low test coverage

**Diagnosis:**
- Tests not updated after implementation
- Mocks not aligned with actual API
- Edge cases not tested

**Solutions:**

**Solution 1: Update Tests**
```typescript
// Update test expectations
describe('MySQL Monitoring', () => {
  it('displays CPU usage chart', () => {
    const { getByText } = render(<MonitoringTab mysqlId="test-id" />);
    expect(getByText('CPU Usage')).toBeInTheDocument();
  });

  it('updates metrics every 5 seconds', async () => {
    // Mock tRPC call
    vi.mock('@/lib/api/dokploy', () => ({
      trpcQuery: vi.fn().mockResolvedValue({ cpu: 50, memory: 1024 }),
    }));

    const { rerender } = render(<MonitoringTab mysqlId="test-id" />);
    await waitFor(() => {
      // Verify update happened
    });
  });
});
```

**Solution 2: Add Missing Tests**
```bash
# Identify untested code
make shell-client npm run test:coverage

# Add tests for:
# - Component rendering
# - User interactions
# - Error states
# - Loading states
# - Edge cases
```

**Solution 3: Mock tRPC API**
```typescript
// Mock tRPC for unit tests
vi.mock('@/lib/api/dokploy', () => ({
  trpcQuery: vi.fn(),
  trpcMutation: vi.fn(),
}));

// In test
vi.mocked(trpcQuery).mockResolvedValue(mockData);
```

---

## Integration Issues

### Issue: Code Doesn't Integrate with Existing System

**Symptoms:**
- Navigation doesn't work
- Data doesn't load
- Components don't share state
- Duplicate API calls

**Diagnosis:**
- Didn't follow existing patterns
- New components isolated from system
- Missing integration points

**Solutions:**

**Solution 1: Follow tRPC Patterns**
```typescript
// Match existing pattern
// client/src/hooks/deployment/usePostgres.ts

export const useMySQL = (mysqlId: string) => {
  return useQuery({
    queryKey: deploymentKeys.databases.mysql.detail(mysqlId),
    queryFn: () => MySQLService.getById(mysqlId),
  });
};
```

**Solution 2: Use Query Keys Factory**
```typescript
// client/src/hooks/deployment/queryKeys.ts

export const deploymentKeys = {
  databases: {
    mysql: {
      lists: () => ['deployment', 'databases', 'mysql', 'list'] as const,
      detail: (id: string) => ['deployment', 'databases', 'mysql', 'detail', id] as const,
      logs: (id: string) => ['deployment', 'databases', 'mysql', 'logs', id] as const,
    },
  },
};
```

**Solution 3: Integrate with Navigation**
```typescript
// Add route file
// client/src/routes/_app/_auth/dashboard/mysql/$mysqlId.tsx

import { createFileRoute } from '@tanstack/react-router';
import { MySQLService } from '@/services/deployment/mysqlService';

export const Route = createFileRoute('/_app/_auth/dashboard/mysql/$mysqlId')({
  loader: async ({ params }) => {
    return MySQLService.getById(params.mysqlId);
  },
  component: MySQLDetail,
});
```

---

## Performance Issues

### Issue: Slow Metrics Updates

**Symptoms:**
- Metrics take > 5 seconds to load
- UI freezes during updates
- Memory leaks

**Diagnosis:**
- Inefficient polling
- No debouncing
- Component re-renders

**Solutions:**

**Solution 1: Optimize Polling**
```typescript
// Use interval with cleanup
useEffect(() => {
  const interval = setInterval(() => {
    refetch();
  }, 5000);

  return () => clearInterval(interval);
}, [refetch]);
```

**Solution 2: Use TanStack Query Refetch Interval**
```typescript
useQuery({
  queryKey: deploymentKeys.databases.mysql.metrics(mysqlId),
  queryFn: () => MySQLService.getMetrics(mysqlId),
  refetchInterval: 5000,
  staleTime: 0, // Always fresh data
});
```

**Solution 3: Memoize Components**
```typescript
const MemoizedChart = memo(({ data }) => {
  return <LineChart data={data} />;
});
```

---

## Common Anti-Patterns

### Anti-Pattern: Skipping Constitution

**Problem:** Ignoring project constitution leads to inconsistent code.

**Solution:**
```bash
# Run analysis to check compliance
/speckit.analyze

# Fix violations:
# - Add RTL support
# - Fix Docker-only violations
# - Follow service component patterns
```

### Anti-Pattern: Single Implementation Task

**Problem:** One task for entire feature leads to poor quality.

**Solution:**
```markdown
# Break down into multiple tasks
Task 1: Create service structure
Task 2: Implement tRPC integration
Task 3: Build general tab
Task 4: Build environment tab
Task 5: Build logs tab
Task 6: Build monitoring tab
Task 7: Build backups tab
Task 8: Build advanced tab
Task 9: Add routing
Task 10: Write tests
```

### Anti-Pattern: Testing as Afterthought

**Problem:** Tests added at end, incomplete coverage.

**Solution:**
```markdown
# Include testing in task breakdown
Task 3: Build general tab
- Implement component
- Write unit tests
- Write integration tests

Task 10: Comprehensive testing
- Unit tests: All components
- Integration tests: API integration
- E2E tests: Critical user journeys
- Accessibility tests: WCAG 2.1 AA
- RTL tests: Arabic layout
```

---

## Getting Help

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Run Spec Kit with debug
specify init . --ai claude --debug

# Check logs
specify check --debug
```

### Check Environment

```bash
# Check Docker containers
docker ps
docker ps --filter "name=serverless-client"

# Check environment variables
cat .env

# Check Node.js version
make shell-client node --version
```

### Verify Installation

```bash
# Check Spec Kit version
specify --version

# Check available tools
specify check

# Verify AI integration
specify init --help
```

---

## Prevention

### Best Practices to Avoid Issues

1. **Run `/speckit.clarify` before planning**
   - Identifies gaps early
   - Prevents vague requirements

2. **Run `/speckit.analyze` before implementation**
   - Validates consistency
   - Catches coverage gaps

3. **Run `/speckit.checklist` to validate quality**
   - Ensures requirements are complete
   - Catches ambiguities

4. **Always test in Docker**
   - Use `make shell-*` commands
   - Never run on host machine

5. **Follow existing patterns**
   - Review service component builder
   - Match tRPC integration patterns
   - Follow RTL support rules

6. **Write tests alongside code**
   - Don't defer testing
   - Include tests in task breakdown
   - Test edge cases

---

## Summary

Most issues in Spec-Driven Development stem from:
1. Incomplete or vague specifications
2. Not following existing patterns
3. Ignoring project constraints (Docker-only, RTL)
4. Poor task breakdown
5. Skipping quality checks

Use the troubleshooting steps above to:
- Diagnose root causes
- Apply targeted solutions
- Prevent future issues

When in doubt, run:
```bash
/speckit.clarify  # Identify gaps
/speckit.analyze   # Validate consistency
/speckit.checklist # Check quality
```
