# AI Chat Workflow - Complete Implementation Guide

## Architecture Overview

The AI chat workflow consists of 4 main phases:

```
┌─────────────────────┐
│ Chat Initialization │ (Load history, validate credits)
├─────────────────────┤
│ Request Processing  │ (Build context, check web search)
├─────────────────────┤
│ Streaming Response  │ (Stream tokens, track usage)
├─────────────────────┤
│ Completion & Store  │ (Save turn, update credits)
└─────────────────────┘
```

---

## Phase 1: Chat Initialization

### Load Conversation History

```typescript
export const loadConversationHistory = query({
  handler: async (ctx, args: { videoId: Id<"videos">; limit?: number }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Get recent conversation turns
    const turns = await ctx.db
      .query("conversations")
      .filter(c => c.eq(c.field("videoId"), args.videoId))
      .filter(c => c.eq(c.field("userId"), user.subject))
      .order("desc")
      .take(args.limit || 20);

    // Format as messages for OpenAI API
    const messages = turns
      .reverse()
      .flatMap(turn => [
        { role: "user" as const, content: turn.userMessage },
        { role: "assistant" as const, content: turn.aiResponse }
      ]);

    return {
      messages,
      totalTurns: turns.length,
      oldestTurn: turns.length > 0 ? turns[0].createdAt : null,
      newestTurn: turns.length > 0 ? turns[0].createdAt : null
    };
  }
});
```

### Validate User Credits

```typescript
export const validateUserCredits = query({
  handler: async (ctx, args: { videoId: Id<"videos"> }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) {
      return {
        hasCredits: false,
        reason: "No active subscription",
        nextAction: "Upgrade to PRO plan"
      };
    }

    // Check remaining credits
    const used = subscription.creditsUsed || 0;
    const remaining = subscription.creditsAllowed - used;

    if (remaining <= 0) {
      return {
        hasCredits: false,
        reason: "Insufficient credits",
        nextAction: "Upgrade plan or wait for reset",
        resetDate: subscription.resetDate
      };
    }

    return {
      hasCredits: true,
      creditsRemaining: remaining,
      estimatedMessages: Math.floor(remaining / 500), // ~500 credits per message
      resetDate: subscription.resetDate
    };
  }
});
```

---

## Phase 2: Request Processing

### Build System Context

```typescript
export const buildSystemPrompt = async (
  ctx: any,
  videoId: Id<"videos">
): Promise<string> => {
  const video = await ctx.db.get(videoId);
  const transcript = await ctx.db
    .query("transcripts")
    .filter(t => t.eq(t.field("videoId"), videoId))
    .filter(t => t.eq(t.field("status"), "completed"))
    .first();

  let context = `You are a helpful AI assistant for iReadYouTube, a video transcription platform.

Video Title: ${video.title}
Video Duration: ${Math.round(video.duration / 60)} minutes
`;

  // Add transcript excerpt if available
  if (transcript && transcript.fullText) {
    const excerptLength = 3000; // First 3000 characters
    const excerpt = transcript.fullText.substring(0, excerptLength);

    context += `\nVideo Transcript (excerpt):
---
${excerpt}${transcript.fullText.length > excerptLength ? "\n[... full transcript available on request]" : ""}
---

You can reference this transcript to answer questions about the video content.
`;
  }

  // Add speaker information if available
  if (transcript && transcript.speakers && transcript.speakers.length > 0) {
    context += `\nSpeakers identified in this video:
${transcript.speakers.map(s => `- Speaker ${s.id}: ${s.name}`).join("\n")}
`;
  }

  return context;
};
```

### Handle Web Search Request

```typescript
export const processWebSearchRequest = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    userMessage: string;
    approvedByUser: boolean;
  }) => {
    if (!args.approvedByUser) {
      return {
        webSearchPerformed: false,
        reason: "User did not approve"
      };
    }

    // Extract search keywords
    const keywords = extractKeywords(args.userMessage);

    try {
      // Call web search API (e.g., Bing, Google)
      const searchResults = await performWebSearch(keywords);

      // Format results for context
      const formattedResults = searchResults
        .slice(0, 5) // Top 5 results
        .map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          relevance: r.relevance // 0-1 score
        }))
        .filter(r => r.relevance > 0.6);

      return {
        webSearchPerformed: true,
        results: formattedResults,
        searchedFor: keywords.join(", "),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error("Web search failed:", error);
      return {
        webSearchPerformed: false,
        reason: "Search service unavailable",
        fallback: "Using video context only"
      };
    }
  }
});

function extractKeywords(message: string): string[] {
  // Simple keyword extraction (remove stop words, etc.)
  const stopWords = ["what", "is", "the", "a", "an", "in", "on", "at"];
  const words = message
    .toLowerCase()
    .split(/\s+/)
    .filter(w => !stopWords.includes(w) && w.length > 3);

  return words.slice(0, 5); // Top 5 keywords
}

async function performWebSearch(keywords: string[]): Promise<any[]> {
  // Implementation depends on search API (Bing, Google, etc.)
  // Return: [{ title, url, snippet, relevance }, ...]
  // This is a placeholder
  return [];
}
```

---

## Phase 3: Streaming Response

### Stream Chat Completion

```typescript
export const streamChatResponse = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    useWebSearch: boolean;
    webSearchResults?: any[];
  }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Validate credits
    const creditCheck = await validateUserCredits(ctx, args.videoId);
    if (!creditCheck.hasCredits) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message: `${creditCheck.reason}. ${creditCheck.nextAction}`
      });
    }

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt(ctx, args.videoId);

    // Add web search results to context if available
    let systemWithSearch = systemPrompt;
    if (args.webSearchResults && args.webSearchResults.length > 0) {
      systemWithSearch += `\n\nRecent web search results:
${args.webSearchResults
  .map(r => `- "${r.title}" (${r.url}): ${r.snippet}`)
  .join("\n")}

Please cite sources when using this information: [Source: URL]
`;
    }

    try {
      // Create streaming request
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemWithSearch },
          ...args.messages
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.95
      });

      // Collect response and token count
      let fullResponse = "";
      let tokenCount = 0;

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        fullResponse += token;
        tokenCount += 1; // Approximate

        // Yield to client (streaming)
        yield {
          type: "token",
          token,
          totalTokens: tokenCount
        };
      }

      // Estimate actual token usage
      const estimatedInputTokens = estimateTokens(
        systemWithSearch + args.messages.map(m => m.content).join("")
      );
      const estimatedTotalTokens = estimatedInputTokens + tokenCount;

      yield {
        type: "complete",
        fullResponse,
        totalTokens: estimatedTotalTokens
      };

      return {
        success: true,
        response: fullResponse,
        tokenCount: estimatedTotalTokens
      };

    } catch (error) {
      if (error.status === 429) {
        throw new ConvexError({
          code: "RATE_LIMITED",
          message: "AI service is temporarily busy. Please try again in a moment."
        });
      }

      if (error.code === "context_length_exceeded") {
        throw new ConvexError({
          code: "CONTEXT_TOO_LONG",
          message: "Conversation is too long. Please start a new chat."
        });
      }

      throw new ConvexError({
        code: "CHAT_ERROR",
        message: "Failed to generate response. Please try again."
      });
    }
  }
});

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

---

## Phase 4: Completion & Storage

### Store Conversation Turn

```typescript
export const storeConversationTurn = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    userMessage: string;
    aiResponse: string;
    tokenCount: number;
    usedWebSearch: boolean;
    webSearchResults?: any[];
  }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Store conversation turn
    const turnId = await ctx.db.insert("conversations", {
      videoId: args.videoId,
      userId: user.subject,
      userMessage: args.userMessage,
      aiResponse: args.aiResponse,
      tokenCount: args.tokenCount,
      usedWebSearch: args.usedWebSearch,
      webSearchResults: args.webSearchResults,
      createdAt: Date.now()
    });

    // Update user credits
    const creditCost = Math.ceil(args.tokenCount / 100); // 100 tokens = 1 credit
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        creditsUsed: (subscription.creditsUsed || 0) + creditCost,
        lastChatAt: Date.now()
      });
    }

    // Log usage for analytics
    await ctx.db.insert("chatAnalytics", {
      userId: user.subject,
      videoId: args.videoId,
      messageLength: args.userMessage.length,
      responseLength: args.aiResponse.length,
      tokenCount: args.tokenCount,
      creditCost,
      usedWebSearch: args.usedWebSearch,
      timestamp: Date.now()
    });

    return {
      success: true,
      turnId,
      creditCost,
      creditsRemaining: subscription
        ? subscription.creditsAllowed - (subscription.creditsUsed || 0) - creditCost
        : 0
    };
  }
});
```

### Retrieve Full Conversation

```typescript
export const getFullConversation = query({
  handler: async (ctx, args: { videoId: Id<"videos">; limit?: number }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const turns = await ctx.db
      .query("conversations")
      .filter(c => c.eq(c.field("videoId"), args.videoId))
      .filter(c => c.eq(c.field("userId"), user.subject))
      .order("desc")
      .take(args.limit || 50);

    // Group by conversation session (separated by long gaps)
    const conversations = [];
    let currentConversation = [];
    let lastTime = 0;

    for (const turn of turns.reverse()) {
      const timeSinceLastMessage = lastTime - turn.createdAt;

      // 30 minutes without activity = new conversation
      if (lastTime > 0 && timeSinceLastMessage > 30 * 60 * 1000) {
        conversations.push(currentConversation);
        currentConversation = [];
      }

      currentConversation.push({
        userMessage: turn.userMessage,
        aiResponse: turn.aiResponse,
        timestamp: turn.createdAt,
        tokenCount: turn.tokenCount,
        usedWebSearch: turn.usedWebSearch,
        sources: turn.webSearchResults?.map(r => r.url) || []
      });

      lastTime = turn.createdAt;
    }

    if (currentConversation.length > 0) {
      conversations.push(currentConversation);
    }

    return {
      totalTurns: turns.length,
      conversations,
      videoId: args.videoId
    };
  }
});
```

---

## Cost Tracking

```typescript
interface ChatUsage {
  videoId: Id<"videos">;
  userId: string;
  messagesCount: number;
  totalTokens: number;
  totalCredits: number;
  webSearchCount: number;
  averageResponseTime: number; // ms
  createdAt: number;
}

export const getChatUsageStats = query({
  handler: async (ctx, args: { userId?: string; videoId?: Id<"videos"> }) => {
    let query = ctx.db.query("chatAnalytics");

    if (args.userId) {
      query = query.filter(c => c.eq(c.field("userId"), args.userId));
    }

    if (args.videoId) {
      query = query.filter(c => c.eq(c.field("videoId"), args.videoId));
    }

    const analytics = await query.collect();

    // Calculate statistics
    const totalMessages = analytics.length;
    const totalTokens = analytics.reduce((sum, a) => sum + a.tokenCount, 0);
    const totalCredits = analytics.reduce((sum, a) => sum + a.creditCost, 0);
    const webSearchCount = analytics.filter(a => a.usedWebSearch).length;

    const avgResponseLength =
      analytics.length > 0
        ? analytics.reduce((sum, a) => sum + a.responseLength, 0) /
          analytics.length
        : 0;

    return {
      totalMessages,
      totalTokens,
      totalCredits,
      webSearchCount,
      averageResponseLength: Math.round(avgResponseLength),
      costPer1000Tokens: 0.015, // $0.015 per 1000 tokens (gpt-4o-mini)
      creditCostPerMessage: 5 // approximate
    };
  }
});
```

---

## Key Patterns Summary

| Pattern | Purpose | Usage |
|---------|---------|-------|
| **Streaming** | Stream tokens for real-time feedback | Faster perceived speed, better UX |
| **Web Search** | Search web with user approval | Current information, citations |
| **Context Grounding** | Use transcript in system prompt | Accurate video-specific answers |
| **Rate Limiting** | Handle API rate limits gracefully | Prevent service errors |
| **Credit Tracking** | Track usage for billing | Fair pricing, usage limits |
| **Error Recovery** | Handle token limits, API errors | Graceful degradation |
| **Conversation History** | Persist multi-turn conversations | Contextual follow-ups |
| **Source Citation** | Cite web search sources | Transparent, trustworthy responses |

## Performance Checklist

- ✅ Stream response starts <2s
- ✅ Tokens stream at >5 tokens/second
- ✅ Web search completes <3s
- ✅ Conversation loads <500ms
- ✅ Credit check <100ms
- ✅ Fallback to transcript if search fails
- ✅ Handle token limit exceeded gracefully
- ✅ Support up to 20 conversation turns
