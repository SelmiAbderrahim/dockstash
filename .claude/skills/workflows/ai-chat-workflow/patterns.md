# AI Chat Workflow - Advanced Patterns

Advanced patterns for AI chat implementation, covering edge cases, optimizations, and specialized scenarios.

## Pattern 1: Context Window Management for Long Conversations

Manage context window limits by summarizing old conversations.

```typescript
interface ConversationSummary {
  startTurn: number;
  endTurn: number;
  summary: string;
  keyTopics: string[];
  createdAt: number;
}

export const manageContextWindow = async (
  ctx: any,
  videoId: Id<"videos">,
  conversationTurns: Array<{ userMessage: string; aiResponse: string }>
): Promise<{
  trimmedTurns: Array<{ userMessage: string; aiResponse: string }>;
  summaries: ConversationSummary[];
  totalTokensSaved: number;
}> => {
  const MAX_CONTEXT_TOKENS = 6000; // Leave room for response
  const SUMMARY_THRESHOLD = 4000; // Summarize when context exceeds this

  let totalTokens = estimateTokens(
    conversationTurns.map(t => t.userMessage + t.aiResponse).join("")
  );

  // If under threshold, keep all turns
  if (totalTokens < SUMMARY_THRESHOLD) {
    return {
      trimmedTurns: conversationTurns,
      summaries: [],
      totalTokensSaved: 0
    };
  }

  // Summarize oldest turns
  const summaries: ConversationSummary[] = [];
  let keptTurns = [...conversationTurns];
  let savedTokens = 0;

  while (totalTokens > SUMMARY_THRESHOLD && keptTurns.length > 5) {
    // Keep most recent 5, summarize older ones
    const toSummarize = keptTurns.slice(0, -5);
    const toKeep = keptTurns.slice(-5);

    // Generate summary of old turns
    const summaryPrompt = `Summarize the key points from this conversation:
${toSummarize.map(t => `User: ${t.userMessage}\nAssistant: ${t.aiResponse}`).join("\n\n")}

Provide: 1) A brief summary (2-3 sentences) 2) Key topics discussed (3-5 items)`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.5,
      max_tokens: 500
    });

    const summaryText = summaryResponse.choices[0]?.message?.content || "";
    const topicsMatch = summaryText.match(/Key topics?:?\s*(.+?)(?:\n|$)/i);
    const topics = topicsMatch
      ? topicsMatch[1].split(/[,;]/).map(t => t.trim())
      : [];

    const summary: ConversationSummary = {
      startTurn: 0,
      endTurn: toSummarize.length,
      summary: summaryText,
      keyTopics: topics,
      createdAt: Date.now()
    };

    summaries.push(summary);

    // Calculate tokens saved
    const summarizedTokens = estimateTokens(
      toSummarize.map(t => t.userMessage + t.aiResponse).join("")
    );
    const summaryTokens = estimateTokens(summaryText);
    savedTokens += summarizedTokens - summaryTokens;

    keptTurns = toKeep;
    totalTokens = estimateTokens(toKeep.map(t => t.userMessage + t.aiResponse).join(""));
  }

  return {
    trimmedTurns: keptTurns,
    summaries,
    totalTokensSaved: savedTokens
  };
};

// Usage: Add summaries to system prompt
export const buildEnhancedSystemPrompt = async (
  ctx: any,
  videoId: Id<"videos">,
  conversationHistory: Array<{ userMessage: string; aiResponse: string }>
): Promise<string> => {
  const { trimmedTurns, summaries } = await manageContextWindow(
    ctx,
    videoId,
    conversationHistory
  );

  let prompt = await buildSystemPrompt(ctx, videoId);

  if (summaries.length > 0) {
    prompt += `\n\nPrevious Conversation Context:
${summaries.map(s => `- ${s.summary}\n  Topics: ${s.keyTopics.join(", ")}`).join("\n")}

Current conversation:`;
  }

  return prompt;
};
```

**Key Points**:
- Summarize old conversation turns when approaching token limit
- Preserve recent turns for immediate context
- Use summaries to maintain conversation continuity
- Save tokens and reduce API costs

---

## Pattern 2: Streaming with Interruption & Resume

Handle user interrupting response and resuming later.

```typescript
interface StreamingState {
  streamId: string;
  videoId: Id<"videos">;
  userMessage: string;
  partialResponse: string;
  totalTokens: number;
  isCompleted: boolean;
  interruptedAt?: number;
  resumedAt?: number;
}

class StreamingManager {
  private streams = new Map<string, StreamingState>();

  async startStream(
    videoId: Id<"videos">,
    userMessage: string
  ): Promise<{ streamId: string }> {
    const streamId = crypto.randomUUID();

    this.streams.set(streamId, {
      streamId,
      videoId,
      userMessage,
      partialResponse: "",
      totalTokens: 0,
      isCompleted: false
    });

    return { streamId };
  }

  async streamToken(streamId: string, token: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.partialResponse += token;
    stream.totalTokens += 1;

    // Send to client
    // (WebSocket, Server-Sent Events, or polling)
  }

  async interruptStream(streamId: string): Promise<{ saved: boolean }> {
    const stream = this.streams.get(streamId);
    if (!stream) return { saved: false };

    stream.interruptedAt = Date.now();

    // Save partial response
    // User can resume or discard
    return { saved: true };
  }

  async resumeStream(streamId: string): Promise<{
    partialResponse: string;
    canResume: boolean;
  }> {
    const stream = this.streams.get(streamId);
    if (!stream || stream.isCompleted) {
      return { partialResponse: "", canResume: false };
    }

    // Check if stream is stale (>5 minutes)
    const isStale = stream.interruptedAt && Date.now() - stream.interruptedAt > 5 * 60 * 1000;

    if (isStale) {
      // Discard and start fresh
      this.streams.delete(streamId);
      return { partialResponse: "", canResume: false };
    }

    stream.resumedAt = Date.now();
    return {
      partialResponse: stream.partialResponse,
      canResume: true
    };
  }

  async completeStream(streamId: string): Promise<{ success: boolean }> {
    const stream = this.streams.get(streamId);
    if (!stream) return { success: false };

    stream.isCompleted = true;

    // Could also auto-clean after 1 hour
    setTimeout(() => this.streams.delete(streamId), 60 * 60 * 1000);

    return { success: true };
  }
}

// Usage
const streamingManager = new StreamingManager();

export const handleStreamInterrupt = action({
  handler: async (ctx, args: { streamId: string }) => {
    return await streamingManager.interruptStream(args.streamId);
  }
});

export const handleStreamResume = action({
  handler: async (ctx, args: { streamId: string }) => {
    return await streamingManager.resumeStream(args.streamId);
  }
});
```

**Key Points**:
- Track streaming state with unique IDs
- Allow user to pause/resume long responses
- Auto-discard stale streams (>5 minutes)
- Preserve partial response for resume

---

## Pattern 3: Dynamic Model Selection Based on Query

Select appropriate model (fast vs accurate) based on query complexity.

```typescript
enum ModelSelection {
  FAST = "gpt-4o-mini",      // Faster, cheaper
  STANDARD = "gpt-4o",       // Balanced
  ADVANCED = "gpt-4-turbo"   // Slower, more accurate
}

function selectModel(userMessage: string): ModelSelection {
  // Analyze message for complexity
  const wordCount = userMessage.split(/\s+/).length;
  const hasComplexTerms = /analyze|compare|summarize|explain|why|how/.test(userMessage.toLowerCase());
  const isFollowUp = userMessage.length < 50; // Short follow-ups are usually simple

  if (isFollowUp && !hasComplexTerms) {
    return ModelSelection.FAST; // Quick yes/no answers
  }

  if (wordCount > 100 || hasComplexTerms) {
    return ModelSelection.ADVANCED; // Complex questions need better model
  }

  return ModelSelection.STANDARD; // Default middle ground
}

export const selectModelByQuery = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    userMessage: string;
    allowedModels?: string[];
  }) => {
    let selectedModel = selectModel(args.userMessage);

    // Respect model restrictions (e.g., free tier only gets FAST)
    if (args.allowedModels && !args.allowedModels.includes(selectedModel)) {
      selectedModel = args.allowedModels[0] as ModelSelection;
    }

    // Get cost difference
    const costs = {
      [ModelSelection.FAST]: 0.00015, // $0.15 per 1M tokens
      [ModelSelection.STANDARD]: 0.0005,
      [ModelSelection.ADVANCED]: 0.001
    };

    return {
      selectedModel,
      costPerMToken: costs[selectedModel],
      estimatedCostForResponse: Math.round(costs[selectedModel] * 0.5), // Assume 500 tokens
      reasoning: {
        wordCount: args.userMessage.split(/\s+/).length,
        isComplex: /analyze|compare|summarize/.test(args.userMessage.toLowerCase())
      }
    };
  }
});
```

**Key Points**:
- Simple questions use fast models (save cost)
- Complex questions use advanced models (better quality)
- User tier determines model access
- Dynamic selection balances cost and quality

---

## Pattern 4: Web Search Approval Workflow with Caching

Cache web search results and ask for approval only once per query.

```typescript
interface CachedSearchResult {
  query: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  createdAt: number;
  expiresAt: number;
}

class WebSearchCache {
  private cache = new Map<string, CachedSearchResult>();

  async searchWithCache(
    query: string,
    cacheMaxAgeMs: number = 3600000 // 1 hour
  ): Promise<{
    results: any[];
    fromCache: boolean;
    cacheAge: number;
  }> {
    // Check cache
    const cached = this.cache.get(query);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
      return {
        results: cached.results,
        fromCache: true,
        cacheAge: now - cached.createdAt
      };
    }

    // Perform fresh search
    const results = await performWebSearch(query.split(/\s+/));

    // Cache results
    this.cache.set(query, {
      query,
      results,
      createdAt: now,
      expiresAt: now + cacheMaxAgeMs
    });

    return {
      results,
      fromCache: false,
      cacheAge: 0
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

const searchCache = new WebSearchCache();

// UI: Ask approval once per unique query
export const requestWebSearchApproval = async (
  videoId: Id<"videos">,
  userMessage: string
): Promise<{
  shouldAsk: boolean;
  cachedResults?: any[];
  query: string;
}> => {
  const query = extractKeywords(userMessage).join(" ");

  const { results, fromCache } = await searchCache.searchWithCache(query);

  return {
    shouldAsk: !fromCache, // Only ask if fresh search needed
    cachedResults: fromCache ? results : undefined,
    query
  };
};

// If user approves, results are already cached
export const getCachedSearchResults = action({
  handler: async (ctx, args: { query: string }) => {
    const { results } = await searchCache.searchWithCache(args.query);
    return results;
  }
});
```

**Key Points**:
- Cache search results for 1 hour
- Only ask user approval for new searches
- Reduce API calls and user interruptions
- Return cached results immediately if available

---

## Pattern 5: Cost-Optimized Response Generation

Use cost optimization techniques while maintaining quality.

```typescript
interface CostOptimizations {
  useCache: boolean; // OpenAI cache API
  temperature: number; // 0.5 for deterministic, 0.7 for creative
  maxTokens: number; // Limit output length
  useWebSearch: boolean; // Expensive, ask first
  compressionLevel: "none" | "moderate" | "aggressive";
}

function calculateOptimization(
  userTier: "free" | "pro" | "enterprise",
  messageComplexity: number // 0-1
): CostOptimizations {
  if (userTier === "free") {
    return {
      useCache: true,
      temperature: 0.5, // Deterministic = faster
      maxTokens: 500, // Limit output
      useWebSearch: false, // Too expensive
      compressionLevel: "aggressive" // Shorter responses
    };
  }

  if (userTier === "pro") {
    return {
      useCache: true,
      temperature: messageComplexity > 0.7 ? 0.8 : 0.6,
      maxTokens: 1500,
      useWebSearch: true, // Ask for approval
      compressionLevel: "moderate"
    };
  }

  // Enterprise
  return {
    useCache: true,
    temperature: 0.8,
    maxTokens: 4000,
    useWebSearch: true, // Auto-approve
    compressionLevel: "none" // No compression
  };
}

export const optimizedChatResponse = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    messages: any[];
    userTier: "free" | "pro" | "enterprise";
  }) => {
    const complexity = analyzeComplexity(args.messages.at(-1)?.content || "");
    const optimizations = calculateOptimization(args.userTier, complexity);

    const response = await openai.chat.completions.create({
      model: args.userTier === "free" ? "gpt-4o-mini" : "gpt-4o",
      messages: args.messages,
      temperature: optimizations.temperature,
      max_tokens: optimizations.maxTokens,
      // Enable caching to reduce API calls
      extra_headers: optimizations.useCache ? {
        "Anthropic-Cache-Control": "ephemeral"
      } : undefined
    });

    return {
      response: response.choices[0]?.message?.content,
      optimizations,
      estimatedCost: calculateCost(response.usage?.total_tokens || 0)
    };
  }
});

function analyzeComplexity(message: string): number {
  const complexWords = message.match(/analyze|compare|explain|research/gi) || [];
  const questionMarks = (message.match(/\?/g) || []).length;
  const wordCount = message.split(/\s+/).length;

  return Math.min(1, (complexWords.length * 0.3 + questionMarks * 0.2 + (wordCount > 50 ? 0.2 : 0)) / 0.7);
}
```

**Key Points**:
- Free tier: Fast, cheap, limited
- Pro tier: Balanced cost and quality
- Enterprise: No restrictions
- Cache results to reduce API calls

---

## Pattern 6: Conversation Export & Sharing

Export conversations for sharing or archiving.

```typescript
type ExportFormat = "markdown" | "json" | "pdf" | "txt";

export const exportConversation = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    format: ExportFormat;
    includeTimestamps?: boolean;
    includeWebSources?: boolean;
  }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Fetch conversation
    const conversation = await ctx.db
      .query("conversations")
      .filter(c => c.eq(c.field("videoId"), args.videoId))
      .filter(c => c.eq(c.field("userId"), user.subject))
      .collect();

    let exported = "";

    if (args.format === "markdown") {
      exported = exportAsMarkdown(conversation, args);
    } else if (args.format === "json") {
      exported = JSON.stringify(conversation, null, 2);
    } else if (args.format === "txt") {
      exported = exportAsPlainText(conversation, args);
    } else if (args.format === "pdf") {
      // Use pdf library
      exported = await exportAsPDF(conversation, args);
    }

    return {
      exported,
      format: args.format,
      size: exported.length,
      turnCount: conversation.length
    };
  }
});

function exportAsMarkdown(
  conversation: any[],
  options: any
): string {
  let md = "# Conversation Export\n\n";

  for (const turn of conversation) {
    if (options.includeTimestamps) {
      md += `*${new Date(turn.createdAt).toLocaleString()}*\n\n`;
    }

    md += `**You:** ${turn.userMessage}\n\n`;
    md += `**AI:** ${turn.aiResponse}\n\n`;

    if (options.includeWebSources && turn.webSearchResults) {
      md += `Sources:\n`;
      for (const source of turn.webSearchResults) {
        md += `- [${source.title}](${source.url})\n`;
      }
      md += "\n";
    }
  }

  return md;
}

function exportAsPlainText(
  conversation: any[],
  options: any
): string {
  let text = "CONVERSATION EXPORT\n\n";

  for (const turn of conversation) {
    if (options.includeTimestamps) {
      text += `[${new Date(turn.createdAt).toLocaleString()}]\n`;
    }

    text += `YOU: ${turn.userMessage}\n\n`;
    text += `AI: ${turn.aiResponse}\n\n`;
    text += "---\n\n";
  }

  return text;
}
```

**Key Points**:
- Export in multiple formats (Markdown, JSON, PDF)
- Include optional timestamps and sources
- Download or share exported conversations
- Archive important discussions

---

## Summary

These patterns provide:
1. **Context management** for long conversations
2. **Streaming interruption** handling
3. **Dynamic model selection** for cost optimization
4. **Web search caching** to reduce approvals
5. **Cost optimization** per user tier
6. **Conversation export** for archiving

Use these patterns to build robust, cost-effective AI chat features.
