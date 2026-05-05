---
name: ruflo-model-routing
description: >
  Guide for intelligent AI model routing ported from Ruflo into ServerlessBase Fire-and-Forget.
  Use when implementing complexity scoring, 3-tier model selection, circuit breaker patterns,
  MoE expert routing, online learning, or cost optimization features.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "ai-routing"
  dependencies: "tRPC, Drizzle ORM, Vitest"
  project: "ServerlessBase Deployment Platform"
---

# Ruflo Model Routing Development Guide

## Overview

Ruflo model routing is a set of TypeScript algorithms ported from the Ruflo project into ServerlessBase's Fire-and-Forget execution pipeline. It provides intelligent model selection based on prompt complexity, with circuit breaker protection, smart retry escalation, online learning, and Mixture-of-Experts (MoE) routing. We port Ruflo's algorithms into our own backend services -- we do NOT run Ruflo's CLI, MCP servers, or hooks in production.

**Keywords**: Ruflo, model routing, complexity scoring, 3-tier routing, circuit breaker, MoE, mixture of experts, online learning, cost optimization, smart retry, escalation chain, multi-provider, Haiku, Sonnet, Opus, GLM

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL.

## When to Use This Skill

- Implementing or modifying complexity scoring logic
- Adjusting 3-tier model routing thresholds
- Working with circuit breaker state machines
- Implementing MoE expert routing per phase
- Adding online learning or weight adjustments
- Building cost optimization or savings dashboards
- Adding a new AI model to the routing system
- Adding a new AI provider (Anthropic, OpenAI, Z.ai, etc.)
- Implementing smart retry escalation
- Building the superadmin routing configuration UI

## Architecture

```
Incoming FF Prompt
    |
    v
+-------------------------------+
|  Complexity Scoring            |  Score 0-1 on: lexical, semantic,
|  (complexity-scoring-service)  |  task scope, uncertainty + phase adj.
+---------------+---------------+
                |
                v
+-------------------------------+
|  Model Routing                 |  Haiku (<0.4), Sonnet (0.3-0.7),
|  (model-routing-service)       |  Opus (>0.6) + org config + learning
+---------------+---------------+
                |
                v
+-------------------------------+
|  Circuit Breaker Check         |  CLOSED -> execute
|  (circuit-breaker-service)     |  OPEN -> use escalation chain
+---------------+---------------+     HALF-OPEN -> test request
                |
                v
+-------------------------------+
|  Multi-Provider Execution      |  Anthropic / OpenAI / Z.ai (GLM)
|  (multi-provider-service)      |  Normalized streaming + tool calls
+---------------+---------------+
                |
                v
+-------------------------------+
|  Outcome Recording             |  Success/failure -> learning service
|  (routing-learning-service)    |  -> weight updates for future routing
+-------------------------------+
```

## Key Concepts

### Complexity Scoring

The complexity scoring service analyzes a prompt and produces a score between 0 and 1 using four weighted features:

| Feature | Weight | Scoring Method |
|---------|--------|----------------|
| Lexical complexity | 0.15 | Word length, sentence structure |
| Semantic depth | 0.35 | High/medium/low keyword detection |
| Task scope | 0.30 | Multi-file patterns, cross-service references |
| Uncertainty level | 0.20 | Ambiguity phrases, question marks |

Phase adjustments are applied after the base score:

| Phase | Adjustment | Rationale |
|-------|------------|-----------|
| scaffold | -0.15 | Boilerplate is simpler |
| polish | -0.20 | Minor refinements |
| integration | +0.15 | Cross-system complexity |
| testing | +0.10 | Edge case reasoning |

```typescript
// Example: scoring a prompt
const baseScore =
  lexicalScore * 0.15 +
  semanticScore * 0.35 +
  taskScopeScore * 0.30 +
  uncertaintyScore * 0.20;

const adjustedScore = Math.max(0, Math.min(1, baseScore + phaseAdjustment));
```

### 3-Tier Model Routing

| Tier | Model Class | Complexity Range | Use Case |
|------|-------------|------------------|----------|
| Tier 1 | Haiku / GLM-4.7-Flash | < 0.4 | Simple: scaffold, config, boilerplate |
| Tier 2 | Sonnet / GLM-4.7 | 0.3 - 0.7 | Moderate: feature implementation, integration |
| Tier 3 | Opus / GLM-5 | > 0.6 | Complex: architecture, debugging, security |

Overlap zones (0.3-0.4 and 0.6-0.7) use a confidence threshold to decide. If the score falls in an overlap zone, the router checks the confidence of the scoring features -- high confidence pushes toward the cheaper tier, low confidence pushes toward the more capable tier.

```typescript
// Example: routing decision
function routeModel(score: number, confidence: number): ModelTier {
  if (score < 0.3) return 'haiku';
  if (score > 0.7) return 'opus';
  if (score < 0.4) return confidence > 0.7 ? 'haiku' : 'sonnet';
  if (score > 0.6) return confidence > 0.7 ? 'sonnet' : 'opus';
  return 'sonnet'; // default middle tier
}
```

### Circuit Breaker

Protects against cascading failures when a model provider is down or degraded.

```
          5 consecutive failures
CLOSED --------------------------> OPEN
  ^                                  |
  |  success                         | 60s timeout
  |                                  v
  +------ success ------------ HALF-OPEN
          (test request)         |
                                 | failure
                                 v
                               OPEN
```

| State | Behavior | Transition |
|-------|----------|------------|
| CLOSED | Normal execution | 5 consecutive failures -> OPEN |
| OPEN | Block requests, use escalation chain | After 60s -> HALF-OPEN |
| HALF-OPEN | Allow 1 test request | Success -> CLOSED, Failure -> OPEN |

State is stored in the `ff_provider_health` table with an in-memory cache for fast lookups.

### Smart Retry Escalation

On failure, escalate model BEFORE self-correction retry:

1. Haiku fails -> escalate to Sonnet
2. Sonnet fails -> escalate to Opus
3. Only after escalation exhausted -> standard self-correction (same model retries)

```typescript
// CORRECT - Escalate model first, then retry
const escalationChain = ['haiku', 'sonnet', 'opus'];
for (const model of escalationChain) {
  try {
    return await callModel(model, prompt);
  } catch (err) {
    if (isLastModel(model, escalationChain)) throw err;
    continue; // escalate to next tier
  }
}
```

### Online Learning

Records execution outcomes per model + phase + complexity bucket to improve future routing decisions.

- Algorithm: Exponential Moving Average (EMA) with alpha = 0.1
- Minimum samples: 10 before adjusting routing
- Blend: 30% learned weights + 70% algorithm scores
- Tracked per: model + phase + complexity bucket (low/medium/high)

```typescript
// EMA update formula
const newWeight = alpha * observedScore + (1 - alpha) * currentWeight;
// alpha = 0.1 (slow learning to avoid overreacting to outliers)
```

### MoE Expert Router

8 expert types with phase-default mapping. Each expert has a specialized system prompt focus.

| Expert | Default Phase | System Prompt Focus |
|--------|---------------|---------------------|
| coder | scaffold, implement | Code generation, patterns |
| architect | planning | System design, architecture |
| tester | testing | Test coverage, edge cases |
| reviewer | review | Code quality, best practices |
| devops | deploy | CI/CD, infrastructure |
| security | security_review | Vulnerability detection |
| optimizer | optimize | Performance, efficiency |
| designer | ui_design | UX patterns, accessibility |

## Implementation Patterns

### Adding a New Model

1. Add model to the provider's model registry (`model-registry.ts`)
2. Define complexity-to-tier mapping in `model-routing-service.ts`
3. Add PAYG pricing seed in `seed-model-pricing.ts`
4. Add to frontend model selector in both WebSmith and App Studio
5. Add to `AGENT_CAPABLE_MODELS` and `THINKING_CAPABLE_MODELS` lists if applicable
6. Test routing with the new model across all tiers

### Adding a New Provider

1. Add provider case in `select-ai-provider.ts` using `createOpenAICompatible()` if API-compatible
2. Add URL detection in `detectProviderFromUrl()`
3. Add model prefix detection in `getProviderTypeFromModel()`
4. Add circuit breaker entry in `ff_provider_health` table
5. Add to `multi-provider-service.ts` for normalized streaming
6. Add provider icon to frontend `PROVIDER_ICONS` map
7. Seed PAYG pricing for all models from the provider

### Adjusting Routing Thresholds

Thresholds are in `model-routing-service.ts`. Change these values to shift routing behavior:

```typescript
// Current thresholds
const TIER_1_MAX = 0.4; // Below this -> Haiku
const TIER_3_MIN = 0.6; // Above this -> Opus
// Between 0.4-0.6 -> Sonnet (with overlap zones using confidence)
```

Phase adjustments are in `complexity-scoring-service.ts`. Change these to alter how phases affect scoring:

```typescript
const PHASE_ADJUSTMENTS: Record<string, number> = {
  scaffold: -0.15,
  polish: -0.20,
  integration: +0.15,
  testing: +0.10,
};
```

### Implementing Cost Breakdown UI

The cost savings service compares actual cost (using routed models) against hypothetical cost (if Opus were used for everything):

```typescript
const actualCost = executions.reduce((sum, e) => sum + e.actualCost, 0);
const opusCost = executions.reduce((sum, e) => sum + e.opusEquivalentCost, 0);
const savings = opusCost > 0 ? ((opusCost - actualCost) / opusCost) * 100 : 0;
```

Display in the `cost-estimate-card.tsx` component with per-tier breakdown.

## Database Tables

| Table | Purpose |
|-------|---------|
| `ff_model_config` | Org-specific phase-to-model mappings |
| `ff_provider_health` | Provider health metrics for circuit breaker |
| `ff_routing_log` | Audit trail for routing decisions |

Additional columns on `ff_prompt`: `modelId`, `providerId`, `modelOverride`, `providerOverride`, `complexityScore`

## FORBIDDEN Patterns

| Pattern | Why | Use Instead |
|---------|-----|-------------|
| Running Ruflo CLI (`npx ruflo`) | External dependency, not production | Ported TypeScript services |
| Importing ruflo packages directly | Coupling to external repo | Copy algorithms into our services |
| Merging `ruflo/.claude/` into root `.claude/` | Config conflict | Our own agents/skills/rules |
| Hardcoded model selection | Defeats routing purpose | `model-routing-service.ts` |
| Scanning `ff_routing_log` for quota | Too slow at scale | Use `ff_model_config` aggregate |
| Ignoring circuit breaker state | Cascading failures | Always check before provider call |
| Skipping outcome recording | Learning cannot improve | Record every execution result |
| Fixed retry without escalation | Wastes tokens on same failing model | Escalate model first, then retry |

## File Location Reference

| Layer | Location |
|-------|----------|
| Complexity Scoring | `serverlessbase/packages/server/src/services/fire-forget/complexity-scoring-service.ts` |
| Model Routing | `serverlessbase/packages/server/src/services/fire-forget/model-routing-service.ts` |
| Circuit Breaker | `serverlessbase/packages/server/src/services/fire-forget/circuit-breaker-service.ts` |
| Multi-Provider | `serverlessbase/packages/server/src/services/fire-forget/multi-provider-service.ts` |
| MoE Expert Router | `serverlessbase/packages/server/src/services/fire-forget/moe-expert-router.ts` |
| Online Learning | `serverlessbase/packages/server/src/services/fire-forget/routing-learning-service.ts` |
| Cost Savings | `serverlessbase/packages/server/src/services/fire-forget/cost-savings-service.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-model-config.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-provider-health.ts` |
| DB Schema | `serverlessbase/packages/server/src/db/schema/ff-routing-log.ts` |
| Frontend Cost Breakdown | `client/src/components/dashboard/app-studio/fire-forget/cost-estimate-card.tsx` |
| Superadmin Dashboard | `client/src/components/superadmin/fire-forget/` |
| Translations | `client/public/locales/{lang}/fireForget.json` (routing.*, costSavings.*, circuitBreaker.*) |
| Rule Reference | `.claude/rules/ruflo-integration.md` |
| Prompt Files | `prompts/ruflo-fire-forget-integration/` |

## Validation Checklist

- [ ] Complexity scoring produces 0-1 score with 4 weighted features
- [ ] Phase adjustments applied correctly (scaffold -0.15, integration +0.15, etc.)
- [ ] 3-tier routing selects correct model class for complexity ranges
- [ ] Overlap zones (0.3-0.4, 0.6-0.7) use confidence to decide
- [ ] Org-specific config overrides from `ff_model_config` applied
- [ ] Circuit breaker state machine: CLOSED -> OPEN (5 failures), OPEN -> HALF-OPEN (60s), HALF-OPEN -> CLOSED (success)
- [ ] Smart retry escalation: Haiku -> Sonnet -> Opus before self-correction
- [ ] Online learning records outcomes per model + phase + complexity bucket
- [ ] Learning blend: 30% learned + 70% algorithm (only after 10 samples)
- [ ] MoE expert system selects correct expert type per FF phase
- [ ] Routing log populated after every execution
- [ ] Cost breakdown shows per-model tier summary and savings percentage
- [ ] Multi-provider service normalizes streaming across Anthropic/OpenAI/Z.ai
- [ ] Provider health monitoring tracks latency and error rates
- [ ] No Ruflo CLI, packages, or hooks in production code
- [ ] All routing UI strings in 5 locales (en, ar, fr, de, es)
- [ ] Per-prompt model override UI available in plan review
- [ ] PAYG metering uses actual model + provider used (not planned)
- [ ] Circuit breaker state visible in superadmin dashboard
- [ ] Docker-only development commands
