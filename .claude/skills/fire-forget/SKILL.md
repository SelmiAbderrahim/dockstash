---
name: fire-forget
description: >
  Comprehensive guide for the Fire-and-Forget AI execution pipeline on ServerlessBase.
  Use when building or modifying FF features including execution lifecycle, prompt management,
  Ralph Wiggum iteration loops, Ruflo model routing, status tracking, adaptive polling,
  auto-retry, sandbox orchestration, and cost estimation.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "ai-execution"
  dependencies: "tRPC, React Query, Vitest, Docker"
  project: "ServerlessBase Deployment Platform"
---

# Fire-and-Forget AI Execution Pipeline

## Overview

Fire-and-Forget (FF) is a multi-phase AI execution pipeline that takes a natural-language description of what to build, generates a sequence of prompts per phase, and executes them against AI models inside Docker sandboxes. It integrates Ralph Wiggum iteration loops for iterative refinement and Ruflo-derived model routing for intelligent model selection.

**Keywords**: fire-and-forget, FF, execution pipeline, prompt generation, Ralph Wiggum, iteration loop, completion promise, verification gate, git checkpoint, hats, presets, Ruflo, model routing, complexity scoring, circuit breaker, adaptive polling, auto-retry, cost estimation, PAYG

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL, Docker sandboxes for code execution.

## When to Use This Skill

- Building or modifying the FF execution pipeline
- Implementing prompt generation or sequencing
- Working with Ralph Wiggum iteration loops (completion promises, verification gates, git checkpoints, hats, presets)
- Implementing Ruflo-derived model routing (complexity scoring, 3-tier routing, circuit breaker, MoE experts)
- Building status tracking, adaptive polling, or auto-retry features
- Working with sandbox orchestration for FF executions
- Implementing cost estimation or PAYG billing for FF
- Adding i18n keys to `fireForget.json`

## Architecture Overview

```
User Input (describe what to build)
    |
    v
+-------------------------------+
|  Context Analysis              |  Analyze project structure,
|  (readiness-indicator)         |  dependencies, existing code
+---------------+---------------+
                |
                v
+-------------------------------+
|  Plan Generation               |  AI generates prompts per phase
|  (prompt-generation-service)   |  (scaffold > implement > test > deploy)
+---------------+---------------+
                |
                v
+-------------------------------+
|  Plan Review                   |  User reviews/edits prompts,
|  (plan-review UI)              |  sets model overrides, approves
+---------------+---------------+
                |
                v
+-------------------------------+
|  Execution Engine              |  For each prompt:
|  (execution-engine-service)    |    1. Route model (Ruflo)
|                                |    2. Ralph iteration loop
|                                |    3. Stream progress
|                                |    4. Auto-retry on failure
+---------------+---------------+
                |
                v
+-------------------------------+
|  Completion                    |  Cost summary, execution history,
|  (execution-complete UI)       |  deploy if configured
+-------------------------------+
```

## Key Concepts

### Execution States

```
pending -> running -> completed
                   -> failed -> (auto-retry) -> running
                   -> paused -> (auto-retry) -> running
                   -> cancelled
```

### Prompt Phases

| Phase | Hat | Purpose |
|-------|-----|---------|
| scaffold | Scaffold Architect | Project structure, boilerplate |
| implement | Backend/Frontend Engineer | Core feature code |
| integrate | Integration Specialist | Connect components |
| test | QA Engineer | Test coverage |
| review | Code Reviewer | Quality check |
| optimize | Code Reviewer | Performance |
| deploy | DevOps Engineer | Deployment config |

### Ralph Wiggum Iteration Loop

Server-side loop feeding previous AI output back into prompts until completion promise is detected and verification passes.

```
For each FF Prompt (phase):
    Ralph Iteration Loop:
        1. Build iteration prompt (previous output + hat system prompt)
        2. Call AI model (stream response)
        3. Check Completion Promise (detected in output?)
        4. Run Verification Gate (typecheck, lint, test in sandbox)
        5. Maybe Git Checkpoint (every N iterations)
        6. Decision: promise met AND verification passed? -> STOP : -> NEXT ITERATION
```

Key rules:
- Loops MUST run server-side only (survive browser disconnects)
- `maxIterationsPerPrompt` (default 5) and `maxIterationsTotal` (default 30) enforced
- Stream progress events via tRPC streaming
- PAYG billing tracked per-iteration server-side

See `.claude/rules/ralph-wiggum-integration.md` for full specification.

### Ruflo Model Routing

Intelligent model selection based on prompt complexity scoring. Routes to Haiku (<0.4), Sonnet (0.3-0.7), or Opus (>0.6) with circuit breaker protection and online learning.

```
Prompt -> Complexity Scoring (0-1) -> 3-Tier Routing -> Circuit Breaker -> Provider Execution -> Outcome Recording
```

Key rules:
- On failure, escalate model BEFORE self-correction retry (Haiku -> Sonnet -> Opus)
- Online learning: EMA with alpha=0.1, minimum 10 samples, 30% learned + 70% algorithm blend
- MoE expert router selects specialized system prompt per phase

See `.claude/rules/ruflo-integration.md` for full specification.

### Adaptive Polling

Never use fixed intervals. Use idle-time-based adaptive intervals:

| Idle Duration | Poll Interval |
|---------------|---------------|
| 0-30 seconds | 3 seconds |
| 30s-2 minutes | 10 seconds |
| 2+ minutes | 30 seconds |

Stop polling when browser tab is hidden. Resume on visibility change.

### Auto-Retry

Triggers on BOTH `failed` AND `paused` statuses (not just `failed`). Configurable delay (5s/10s/30s/60s). Max retries per execution (default 3). UI shows countdown timer and retry count.

## Implementation Patterns

### Creating an Execution

```typescript
import { trpcMutation } from '@/lib/api/dokploy';

const execution = await trpcMutation('fireForget', 'execution.create', {
  projectId,
  description: userInput,
  preset: 'fullstack', // Ralph preset
});
```

### Status Polling with React Query

```typescript
import { fireForgetKeys } from '@/hooks/fire-forget/queryKeys';

useQuery({
  queryKey: fireForgetKeys.execution.status(executionId),
  queryFn: () => FireForgetService.getStatus(executionId),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (['completed', 'cancelled'].includes(status)) return false;
    return getAdaptiveInterval(lastActivityRef.current);
  },
});
```

### Adaptive Polling Helper

```typescript
function getAdaptiveInterval(lastActivityAt: number): number {
  const idleMs = Date.now() - lastActivityAt;
  if (idleMs < 30_000) return 3_000;
  if (idleMs < 120_000) return 10_000;
  return 30_000;
}
```

### Model Routing Integration

```typescript
// In execution engine, before AI call:
const complexity = await complexityScoringService.score(prompt, phase);
const routingResult = await modelRoutingService.route(complexity, phase, orgConfig);
const model = routingResult.modelId; // e.g., "claude-3-haiku" or "glm-4.7-flash"
```

### Server-Side Iteration Loop

```typescript
// CORRECT - Server-side loop with max iterations and streaming
for (let i = 0; i < maxIterations; i++) {
  yield { type: 'iteration_start', iteration: i, hatName, hatEmoji };

  const output = await callAiModel(prompt, hatSystemPrompt);
  const promiseDetected = await checkCompletionPromise(output, completionPromise);
  const verificationPassed = await runVerificationGate(sandboxId, verificationCommands);

  yield { type: 'iteration_complete', iteration: i, promiseDetected, verificationPassed };

  if (promiseDetected && verificationPassed) {
    yield { type: 'loop_complete', totalIterations: i + 1, promiseMet: true };
    break;
  }

  if (i % gitCheckpointInterval === 0) {
    const commitHash = await gitCheckpoint(sandboxId, i);
    yield { type: 'checkpoint_created', iteration: i, commitHash };
  }
}
```

## React Query Key Factory

```typescript
export const fireForgetKeys = {
  all: ['fire-forget'] as const,
  execution: {
    all: () => [...fireForgetKeys.all, 'execution'] as const,
    lists: () => [...fireForgetKeys.execution.all(), 'list'] as const,
    detail: (id: string) => [...fireForgetKeys.execution.all(), 'detail', id] as const,
    status: (id: string) => [...fireForgetKeys.execution.all(), 'status', id] as const,
    prompts: (id: string) => [...fireForgetKeys.execution.all(), 'prompts', id] as const,
    cost: (id: string) => [...fireForgetKeys.execution.all(), 'cost', id] as const,
  },
  history: {
    all: () => [...fireForgetKeys.all, 'history'] as const,
    lists: (filters?: object) => [...fireForgetKeys.history.all(), 'list', filters] as const,
  },
  routing: {
    all: () => [...fireForgetKeys.all, 'routing'] as const,
    config: (orgId: string) => [...fireForgetKeys.routing.all(), 'config', orgId] as const,
    savings: (orgId: string) => [...fireForgetKeys.routing.all(), 'savings', orgId] as const,
  },
};
```

**ALWAYS use the factory. NEVER use ad-hoc keys.**

## Frontend Rules

- Table views for execution history (not card grids)
- Inline action buttons (not dropdown menus)
- RTL with logical properties (`ms-*`, `me-*`, `text-start`, `text-end`)
- NEVER use `rtl:flex-row-reverse` (native RTL handles flex direction)
- Dark mode with semantic tokens (`bg-card`, `text-foreground`)
- Touch targets 44x44px minimum
- Adaptive polling with visibility-based optimization
- Auto-retry on failed AND paused
- All strings in `fireForget.json` across 5 locales (en, ar, fr, de, es)
- No Uncodixify violations (no card lift, no animate-pulse, shadow-sm max)

## Streaming Events Reference

| Event | Payload | When |
|-------|---------|------|
| `iteration_start` | `{ iteration, maxIterations, hatName, hatEmoji }` | Before each AI call |
| `iteration_complete` | `{ iteration, promiseDetected, verificationPassed, output }` | After verification |
| `checkpoint_created` | `{ iteration, commitHash }` | After git commit |
| `loop_complete` | `{ totalIterations, promiseMet, finalVerification }` | Loop finished normally |
| `loop_max_reached` | `{ totalIterations, maxIterations }` | Hit iteration limit |

## File Location Reference

| Layer | Location |
|-------|----------|
| Execution Engine | `serverlessbase/packages/server/src/services/fire-forget/execution-engine-service.ts` |
| Prompt Generation | `serverlessbase/packages/server/src/services/fire-forget/prompt-generation-service.ts` |
| Completion Promise | `serverlessbase/packages/server/src/services/fire-forget/completion-promise-service.ts` |
| Verification Gate | `serverlessbase/packages/server/src/services/fire-forget/verification-gate-service.ts` |
| Git Checkpoint | `serverlessbase/packages/server/src/services/fire-forget/git-checkpoint-service.ts` |
| Ralph Hats | `serverlessbase/packages/server/src/services/fire-forget/ralph-hats-config.ts` |
| Ralph Presets | `serverlessbase/packages/server/src/services/fire-forget/ralph-presets.ts` |
| Model Routing | `serverlessbase/packages/server/src/services/fire-forget/model-routing-service.ts` |
| Complexity Scoring | `serverlessbase/packages/server/src/services/fire-forget/complexity-scoring-service.ts` |
| Circuit Breaker | `serverlessbase/packages/server/src/services/fire-forget/circuit-breaker-service.ts` |
| MoE Expert Router | `serverlessbase/packages/server/src/services/fire-forget/moe-expert-router.ts` |
| Online Learning | `serverlessbase/packages/server/src/services/fire-forget/routing-learning-service.ts` |
| Multi-Provider | `serverlessbase/packages/server/src/services/fire-forget/multi-provider-service.ts` |
| Cost Savings | `serverlessbase/packages/server/src/services/fire-forget/cost-savings-service.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-model-config.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-provider-health.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-routing-log.ts` |
| Frontend Components | `client/src/components/dashboard/app-studio/fire-forget/` |
| Frontend Hooks | `client/src/hooks/fire-forget/` |
| Frontend Service | `client/src/services/fire-forget/fireForgetService.ts` |
| Query Keys | `client/src/hooks/fire-forget/queryKeys.ts` |
| Translations | `client/public/locales/{lang}/fireForget.json` |
| Tests | `client/src/__tests__/fire-forget/` |
| Component Tests | `client/src/components/dashboard/app-studio/fire-forget/__tests__/` |
| Superadmin Dashboard | `client/src/components/superadmin/fire-forget/` |
| Rule: FF Patterns | `.claude/rules/fire-forget-patterns.md` |
| Rule: Ralph | `.claude/rules/ralph-wiggum-integration.md` |
| Rule: Ruflo | `.claude/rules/ruflo-integration.md` |
| Prompt Files | `prompts/ralph-wiggum-fire-forget/`, `prompts/ruflo-fire-forget-integration/` |

## Validation Checklist

- [ ] Execution lifecycle states correct (pending -> running -> completed/failed/cancelled)
- [ ] Adaptive polling: 3s/10s/30s based on idle time
- [ ] Visibility-based polling: stops when tab hidden
- [ ] Auto-retry triggers on both `failed` AND `paused`
- [ ] Ralph iteration loop runs server-side only
- [ ] Completion promise detected in AI output
- [ ] Verification gate runs between iterations
- [ ] Git checkpoint every N iterations (configurable, default 3)
- [ ] All 7 hats defined with system prompts
- [ ] All 4 presets defined (code-assist, debug, fullstack, deploy-ready)
- [ ] `maxIterationsPerPrompt` (default 5) and `maxIterationsTotal` (default 30) enforced
- [ ] Complexity scoring produces 0-1 with phase adjustments
- [ ] 3-tier routing selects correct model (Haiku < 0.4, Sonnet 0.3-0.7, Opus > 0.6)
- [ ] Circuit breaker state machine: CLOSED -> OPEN (5 failures), OPEN -> HALF-OPEN (60s)
- [ ] Smart retry escalation: Haiku -> Sonnet -> Opus before self-correction
- [ ] Online learning records outcomes per model + phase + complexity bucket
- [ ] MoE expert selection per phase
- [ ] Per-prompt model override in plan review UI
- [ ] Cost breakdown shows per-model savings
- [ ] PAYG billing per-iteration accurate
- [ ] React Query key factory used (no ad-hoc keys)
- [ ] All strings in 5 locales (en, ar, fr, de, es)
- [ ] RTL with logical properties, dark mode with semantic tokens
- [ ] Touch targets 44x44px minimum
- [ ] Docker-only development commands
- [ ] No Uncodixify violations
