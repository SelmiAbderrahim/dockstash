---
name: zai-glm-integration
description: >
  Guide for Z.ai (Zhipu AI) GLM model provider integration in ServerlessBase.
  Use when configuring Z.ai provider, adding GLM models to registries, setting up PAYG pricing,
  updating frontend model selectors, or verifying cross-service GLM support.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "ai-provider"
  dependencies: "@ai-sdk/openai-compatible, tRPC"
  project: "ServerlessBase Deployment Platform"
---

# Z.ai GLM Provider Integration Guide

## Overview

Z.ai (Zhipu AI) is an AI model provider offering the GLM family of models. Integration uses the `@ai-sdk/openai-compatible` SDK with a single backend change in `select-ai-provider.ts` that enables GLM models across ALL ServerlessBase AI services: Chatbot, Fire-and-Forget, WebSmith, App Studio, and MCP API.

**Keywords**: Z.ai, Zhipu AI, GLM, glm-5, glm-4.7, glm-4.7-flash, model provider, OpenAI-compatible, PAYG, free tier, model registry

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL, Vercel AI SDK.

## When to Use This Skill

- Setting up Z.ai as a new provider in the backend
- Adding GLM models to WebSmith or App Studio model registries
- Seeding PAYG pricing for GLM models
- Updating frontend model selectors to include GLM options
- Handling the free-tier `glm-4.7-flash` model in billing
- Configuring Z.ai API key in superadmin settings
- Testing cross-service GLM integration
- Detecting Z.ai provider from API URL or model ID

## Architecture: Single Backend Change

The critical insight is that a single case in `select-ai-provider.ts` enables Z.ai across every AI-consuming service:

```
select-ai-provider.ts (case "zai")
    |
    +-- Chatbot        (uses select-ai-provider)
    +-- Fire-and-Forget (uses select-ai-provider via model-routing)
    +-- WebSmith       (uses select-ai-provider)
    +-- App Studio     (uses select-ai-provider)
    +-- MCP API        (uses select-ai-provider)
```

No per-service integration code is needed. Once the backend provider is registered, all services can use GLM models.

## GLM Model Registry (5 Models)

| Model ID | Context | Input ($/1M) | Output ($/1M) | Tier | Capabilities |
|----------|---------|--------------|----------------|------|--------------|
| `glm-5.1` | 128K | ~$1.00 | ~$3.00 | Flagship | Thinking, tool use, agent-capable |
| `glm-5` | 128K | $0.72 | $2.30 | Foundation | Thinking, tool use, agent-capable |
| `glm-5-turbo` | 128K | ~$0.50 | ~$1.50 | Fast | Tool use |
| `glm-4.7` | 128K | $0.39 | $1.75 | Strong | Thinking, tool use, agent-capable |
| `glm-4.7-flash` | 128K | FREE ($0) | FREE ($0) | Free | Basic completion |

## Implementation Patterns

### Setting Up Z.ai Backend Provider

Add the `"zai"` case to `select-ai-provider.ts`:

```typescript
// serverlessbase/packages/server/src/utils/ai/select-ai-provider.ts
case "zai":
  return createOpenAICompatible({
    name: "zai",
    baseURL: apiUrl || "https://api.z.ai/api/paas/v4/",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
```

### Provider Detection

Two detection methods are needed so that the system automatically identifies Z.ai from either a URL or a model ID:

```typescript
// URL-based detection
function detectProviderFromUrl(apiUrl: string): string {
  if (apiUrl.includes("api.z.ai")) return "zai";
  // ... existing detections for openai, anthropic, etc.
}

// Model-based detection
function getProviderTypeFromModel(modelId: string): string {
  if (modelId.startsWith("glm-")) return "zai";
  // ... existing detections for claude-, gpt-, etc.
}
```

### Adding Models to Registries

Both WebSmith and App Studio have model registries that must include all 5 GLM models:

```typescript
// In model-registry.ts (both WebSmith and App Studio)
{
  id: "glm-5.1",
  name: "GLM 5.1",
  provider: "zai",
  contextWindow: 128000,
  capabilities: ["thinking", "tools", "agent"],
},
{
  id: "glm-4.7-flash",
  name: "GLM 4.7 Flash",
  provider: "zai",
  contextWindow: 128000,
  capabilities: ["completion"],
},
// ... all 5 models
```

Update capability lists:

```typescript
const AGENT_CAPABLE_MODELS = [...existing, "glm-5.1", "glm-5", "glm-4.7"];
const THINKING_CAPABLE_MODELS = [...existing, "glm-5.1", "glm-5", "glm-4.7"];
const PROVIDER_ICONS = { ...existing, zai: "Z" };
```

### Seeding PAYG Pricing

Seed all 5 GLM models with 4x platform markup:

```typescript
// In seed-model-pricing.ts
const glmModels = [
  { modelId: "glm-5.1", provider: "zai", inputCentsPerMillion: 400, outputCentsPerMillion: 1200 },
  { modelId: "glm-5", provider: "zai", inputCentsPerMillion: 288, outputCentsPerMillion: 920 },
  { modelId: "glm-5-turbo", provider: "zai", inputCentsPerMillion: 200, outputCentsPerMillion: 600 },
  { modelId: "glm-4.7", provider: "zai", inputCentsPerMillion: 156, outputCentsPerMillion: 700 },
  { modelId: "glm-4.7-flash", provider: "zai", inputCentsPerMillion: 0, outputCentsPerMillion: 0 },
];
```

### Free-Tier Handling (CRITICAL)

`glm-4.7-flash` has zero cost. The billing pipeline MUST handle this explicitly:

```typescript
// CORRECT - Handle zero cost explicitly
const cost = inputTokens * inputRate + outputTokens * outputRate;
// cost may be 0 for free models -- this is valid, do NOT skip logging

// WRONG - Assumes non-zero cost
const costPerToken = totalCost / totalTokens; // division by zero if cost is 0
```

PAYG logs MUST still record `provider: "zai"` with actual token counts even when cost is zero. Never skip logging for free models.

### Superadmin Configuration

Three superadmin touchpoints:

1. **Service Keys**: Add `ZAI_API_KEY` to the service keys configuration
2. **Connection Test**: Add Z.ai to `TESTABLE_KEYS` array so admins can verify the key
3. **Chatbot Provider**: Add Z.ai option to `AI_PROVIDERS` dropdown

```typescript
// In superadmin router - service keys
const TESTABLE_KEYS = [...existing, "ZAI_API_KEY"];

// In chatbot config - provider dropdown
const AI_PROVIDERS = [...existing, { value: "zai", label: "Z.ai (GLM)" }];
```

### Testing Cross-Service Integration

After implementing, verify GLM models work in all five services:

1. **Chatbot**: Select a GLM model in chatbot settings, send a test message
2. **Fire-and-Forget**: Create an FF execution, verify routing can select GLM models
3. **WebSmith**: Create a project, select a GLM model in the model selector
4. **App Studio**: Create a project, select a GLM model in the model selector
5. **MCP API**: Make an API call specifying a GLM model

All five should work with no per-service changes beyond the single `select-ai-provider.ts` case.

## FORBIDDEN Patterns

| Pattern | Why | Use Instead |
|---------|-----|-------------|
| Separate GLM SDK import | Unnecessary dependency | `createOpenAICompatible()` handles it |
| Hardcoded API key | Security risk | Encrypted in DB via superadmin |
| Provider string `"zhipu"` or `"glm"` | Inconsistent naming | Always `"zai"` |
| Skipping PAYG seed for GLM models | Billing errors | Run seed script with GLM entries |
| Zero-cost model causing billing errors | Division by zero, null checks | Handle 0 cost explicitly in billing |
| Missing model in BOTH registries | Inconsistent availability | Add to WebSmith AND App Studio registries |
| Skipping PAYG log for free models | Incomplete usage data | Log with 0 cost, real token counts |

## File Location Reference

| Layer | Location |
|-------|----------|
| Provider Selection | `serverlessbase/packages/server/src/utils/ai/select-ai-provider.ts` |
| WebSmith Model Registry | `serverlessbase/packages/server/src/services/websmith/model-registry.ts` |
| App Studio Model Registry | `serverlessbase/packages/server/src/services/app-studio/model-registry.ts` |
| PAYG Seed | `serverlessbase/packages/server/src/services/payg/seed-model-pricing.ts` |
| Superadmin Router | `serverlessbase/apps/serverlessbase/server/api/routers/superadmin.ts` |
| Frontend AI Types | `client/src/types/ai-assistants.ts`, `client/src/types/ai-settings.ts` |
| WebSmith Model Selector | `client/src/components/dashboard/websmith/builder/mode-selector.tsx` |
| App Studio Model Selector | `client/src/components/dashboard/app-studio/builder/mode-selector.tsx` |
| Chatbot Provider Config | `client/src/components/superadmin/chatbot/ChatbotConfigTab.tsx` |
| Translations | `client/public/locales/{lang}/superadmin.json` (integrations.zai.*) |
| Rule Reference | `.claude/rules/zai-provider-patterns.md` |
| Prompt Files | `prompts/zai-glm-provider-integration/` |

## Validation Checklist

- [ ] Provider string is `"zai"` everywhere (never `"zhipu"`, `"glm"`, or `"z.ai"`)
- [ ] `select-ai-provider.ts` has `case "zai"` using `createOpenAICompatible()`
- [ ] URL detection: `api.z.ai` -> `"zai"`
- [ ] Model detection: `glm-*` prefix -> `"zai"`
- [ ] All 5 GLM models in WebSmith model registry
- [ ] All 5 GLM models in App Studio model registry
- [ ] PAYG seed includes all 5 GLM models with 4x markup
- [ ] `glm-4.7-flash` at 0 cost handled correctly in billing (no division by zero)
- [ ] PAYG logs record free model usage with 0 cost and real token counts
- [ ] `ZAI_API_KEY` in superadmin service keys
- [ ] Z.ai in `TESTABLE_KEYS` for connection testing
- [ ] Z.ai option in chatbot `AI_PROVIDERS` dropdown
- [ ] `PROVIDER_ICONS` includes `zai: "Z"` in both selectors
- [ ] Agent-capable and thinking-capable model lists include GLM models
- [ ] i18n keys in all 5 locales in `superadmin.json` (integrations.zai.*)
- [ ] Cross-service test: Chatbot, FF, WebSmith, App Studio, MCP API all work with GLM models
- [ ] Docker-only development commands
