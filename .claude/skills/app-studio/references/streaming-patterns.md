# Streaming Patterns - App Studio Reference

## Overview

App Studio uses tRPC streaming mutations with Vercel AI SDK's `streamText` for real-time AI responses. The streaming layer handles text, tool calls, tool results, thinking blocks, file change notifications, and usage tracking.

## Stream Chunk Types

```typescript
export interface StreamChunk {
  type:
    | "text"              // AI text response delta
    | "tool-call"         // AI invokes a tool
    | "tool-result"       // Tool execution result
    | "thinking-start"    // Claude thinking begins
    | "thinking-content"  // Claude thinking text delta
    | "thinking-end"      // Claude thinking ends
    | "file-written"      // File was created/modified
    | "usage"             // Token usage stats
    | "error"             // Error occurred
    | "done";             // Generation complete
  content: string;
  metadata?: {
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    tokensInput?: number;
    tokensOutput?: number;
    thinkingDurationMs?: number;
    filePath?: string;
    commitHash?: string;
    versionCreated?: boolean;
  };
}
```

## Backend Streaming (tRPC)

### Agent Mode (with tools)

```typescript
// serverlessbase/packages/server/src/services/app-studio/agent-handler.ts
export async function* handleAgentMessage(input: AgentHandlerInput): AsyncGenerator<StreamChunk> {
  // ... setup ...

  const result = streamText({
    model: aiModel,
    system: systemPrompt,
    messages,
    tools: createAgentTools(containerName),
    maxSteps: 10,
    abortSignal: controller.signal,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "reasoning":
        yield { type: "thinking-content", content: part.textDelta };
        break;
      case "text-delta":
        yield { type: "text", content: part.textDelta };
        break;
      case "tool-call":
        yield { type: "tool-call", content: "", metadata: { toolName: part.toolName, args: part.args } };
        break;
      case "tool-result":
        yield { type: "tool-result", content: "", metadata: { toolName: part.toolName, result: part.result } };
        // Track file modifications
        if (part.toolName === "write_file" && part.result?.success) {
          yield { type: "file-written", content: "", metadata: { filePath: part.result.path } };
        }
        break;
    }
  }

  yield { type: "usage", content: "", metadata: { tokensInput, tokensOutput } };
  yield { type: "done", content: "", metadata: { commitHash, versionCreated } };
}
```

### Chat Mode (no tools)

```typescript
// Simplified streaming without tool calling
export async function* handleChatMessage(input: StreamChatInput): AsyncGenerator<StreamChunk> {
  const result = streamText({
    model: aiModel,
    system: buildChatPrompt(projectContext),
    messages,
    // No tools parameter
  });

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      yield { type: "text", content: part.textDelta };
    }
  }

  yield { type: "done", content: "" };
}
```

## AI Provider Resolution

```typescript
export async function resolveAIProvider(organizationId: string, requestedModel: string) {
  // 1. Determine provider type from model name (e.g., "claude-sonnet-4" → "anthropic")
  const providerType = getProviderTypeFromModel(requestedModel);

  // 2. Look up API key from aiProvider table
  const provider = await db.query.ai.findFirst({
    where: and(eq(ai.organizationId, organizationId), eq(ai.providerType, providerType)),
  });

  // 3. Get service key as fallback
  const serviceKey = await getServiceKey(providerType);

  // 4. Return resolved config
  return { apiUrl: provider?.apiUrl || defaultUrl, apiKey: provider?.apiKey || serviceKey, model: requestedModel };
}
```

## Model Registry

```typescript
interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  supportsTools: boolean;
  supportsThinking: boolean;
  maxTokens: number;
  contextWindow: number;
}

// Agent mode requires supportsTools: true
// Thinking features require supportsThinking: true (Claude only)
```

## Context Compaction

When conversation history grows too long, compaction summarizes older messages:

```typescript
// 1. Check if compaction is needed (based on token count threshold)
// 2. Generate summary using compaction prompt
// 3. Save summary as a special isCompactionSummary=true message
// 4. Update chat.compactedAt timestamp
// 5. Future message builds use: summary + messages after compactedAt
```

### Message Building with Compaction

```typescript
async function buildMessages(chatId: string, newMessage: string): Promise<CoreMessage[]> {
  const chat = await db.query.appStudioChat.findFirst({ where: eq(chatId) });

  if (chat.compactedAt) {
    // Get summary + recent messages after compaction
    const summary = await getCompactionSummary(chatId);
    const recent = await getMessagesAfter(chatId, chat.compactedAt);
    return [...summary, ...recent, { role: "user", content: newMessage }];
  } else {
    // Get all messages (capped at MAX_CONVERSATION_HISTORY=20)
    const all = await getAllMessages(chatId);
    return [...all.slice(-20), { role: "user", content: newMessage }];
  }
}
```

## Token Counting and Usage

After each AI response:

```typescript
// Get final usage from Vercel AI SDK
const usage = await result.usage;
// { promptTokens: 1234, completionTokens: 567 }

// Track in database (upsert pattern)
await db.insert(appStudioUsage).values({
  userId,
  messageCount: 1,
  tokensUsed: usage.promptTokens + usage.completionTokens,
  agentToolCalls: toolCallCount,
}).onConflictDoUpdate({
  target: appStudioUsage.userId,
  set: {
    messageCount: sql`message_count + 1`,
    tokensUsed: sql`tokens_used + ${totalTokens}`,
    agentToolCalls: sql`agent_tool_calls + ${toolCallCount}`,
  },
});
```

## Quota Enforcement

Before starting expensive operations:

```typescript
// Check quota before sending AI message
const check = await usageTracking.checkQuota(userId, 'messages');
if (!check.allowed) {
  yield { type: "error", content: `Message limit reached (${check.current}/${check.limit})` };
  return;
}
```

## Cancellation

Users can cancel in-progress generations:

```typescript
// Frontend: abort controller on the fetch request
// Backend: userSignal forwarded to streamText's abortSignal
// Combined with total timeout controller

if (controller.signal.aborted) {
  const reason = controller.signal.reason?.message || "Generation cancelled";
  yield { type: "error", content: reason };
  return;
}
```

## Error Handling

```typescript
try {
  // Stream AI response...
} catch (error) {
  if (controller.signal.aborted) {
    yield { type: "error", content: "Generation cancelled" };
  } else {
    yield { type: "error", content: error.message || "AI generation failed" };
  }
} finally {
  cleanup(); // Clear timeout timer
  executionLog.completedAt = Date.now();
}

// Always save messages and track usage, even on partial completion
```
