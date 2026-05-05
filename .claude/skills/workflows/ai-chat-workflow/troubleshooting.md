# AI Chat Workflow - Troubleshooting Guide

Common issues and solutions for AI chat integration.

## Issue 1: Streaming Response Never Starts (Stuck on "Thinking...")

**Symptom**: User sees "Thinking..." loading but no tokens arrive

**Root Causes**:
1. API key not configured or invalid
2. Network request never sent (JavaScript error)
3. Streaming endpoint not responding
4. CORS issue preventing response

**Debugging Steps**:

```typescript
// 1. Verify API is accessible
async function testOpenAIConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // Client-side check only
    });

    const response = await openai.models.list();
    console.log("[TEST] OpenAI connection successful:", response.data.length, "models available");

    return { connected: true };
  } catch (error) {
    console.error("[TEST] OpenAI connection failed:", error);
    return {
      connected: false,
      error: String(error)
    };
  }
}

// 2. Check if streaming is enabled
async function testStreamingRequest(): Promise<{
  streaming: boolean;
  error?: string;
}> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'hello'" }],
      stream: true
    });

    let tokenCount = 0;
    for await (const chunk of stream) {
      tokenCount++;
      console.log("[TEST] Received token:", chunk.choices[0]?.delta?.content);
    }

    console.log("[TEST] Streaming successful, received", tokenCount, "tokens");
    return { streaming: true };
  } catch (error) {
    console.error("[TEST] Streaming failed:", error);
    return {
      streaming: false,
      error: String(error)
    };
  }
}

// 3. Check for CORS issues in browser
// Open DevTools Console and run:
// fetch("https://api.openai.com/v1/models", {
//   headers: { Authorization: "Bearer sk-..." }
// }).then(r => r.json()).then(d => console.log(d))
```

**Solutions**:

```typescript
// ✅ Solution 1: Verify API key is set and valid
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not set in environment");
}

if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
  throw new Error("OPENAI_API_KEY appears invalid (should start with sk-)");
}

// ✅ Solution 2: Use action (not query) for streaming
// Queries can't stream, only actions can
export const streamChatResponse = action({
  handler: async (ctx, args) => {
    // Action can stream
  }
});

// ✅ Solution 3: Ensure streaming is enabled in request
const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  stream: true, // MUST be true for streaming
  temperature: 0.7
});

// ✅ Solution 4: Handle different response types
async function handleResponse(response: any) {
  if (response instanceof Stream) {
    // Streaming response
    for await (const chunk of response) {
      yield chunk.choices[0]?.delta?.content;
    }
  } else if (response.choices) {
    // Non-streaming response
    yield response.choices[0]?.message?.content;
  }
}

// ✅ Solution 5: Add timeout to detect stuck requests
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(
    () => reject(new Error("Request timeout after 30s")),
    30000
  )
);

Promise.race([streamingRequest, timeoutPromise])
  .catch(error => {
    console.error("Streaming request failed:", error);
    return { error: "Request timed out" };
  });
```

---

## Issue 2: "Rate Limit Exceeded" Error from OpenAI

**Symptom**: Getting 429 errors, responses fail with "Too many requests"

**Root Causes**:
1. Exceeding API rate limits (requests per minute)
2. Running multiple concurrent chats without throttling
3. Polling too frequently
4. Free trial has extremely low limits

**Debugging Steps**:

```typescript
// 1. Check rate limit headers
async function checkRateLimitStatus(response: any): Promise<{
  requestsRemaining: number;
  resetTime: Date;
  resetIn: number; // seconds
}> {
  const headers = response.headers;

  const requestsRemaining = parseInt(
    headers.get("x-ratelimit-remaining-requests") || "0"
  );
  const resetTime = headers.get("x-ratelimit-reset-requests");

  console.log("[RATE_LIMIT] Status:", {
    requestsRemaining,
    resetTime,
    currentTime: new Date().toISOString()
  });

  return {
    requestsRemaining,
    resetTime: new Date(resetTime),
    resetIn: resetTime ? Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000) : 0
  };
}

// 2. Monitor request rate
class RateLimitMonitor {
  private requests: number[] = [];
  private readonly windowMs = 60000; // 1 minute

  recordRequest(): void {
    this.requests.push(Date.now());
    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
  }

  getRequestsPerMinute(): number {
    return this.requests.length;
  }

  canMakeRequest(limit: number = 500): boolean {
    return this.getRequestsPerMinute() < limit;
  }
}

// 3. Check concurrent requests
function countConcurrentRequests(): number {
  // Track with Set of active request IDs
  return activeRequests.size;
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Implement request queue with rate limiting
class RateLimitedQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private readonly minDelayMs = 100; // Min delay between requests
  private lastRequestTime = 0;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (!fn) break;

      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.minDelayMs) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minDelayMs - elapsed)
        );
      }

      await fn();
      this.lastRequestTime = Date.now();
    }

    this.isProcessing = false;
  }
}

const rateLimitedQueue = new RateLimitedQueue();

// ✅ Solution 2: Batch requests and handle 429 with exponential backoff
async function chatWithRetry(
  messages: any[],
  maxRetries: number = 3
): Promise<string> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await rateLimitedQueue.add(async () => {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          stream: false
        });
        return response.choices[0]?.message?.content || "";
      });
    } catch (error: any) {
      lastError = error;

      if (error.status === 429) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[RETRY] Rate limited, waiting ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

// ✅ Solution 3: Cache responses to reduce API calls
const responseCache = new Map<string, { response: string; timestamp: number }>();

export const chatWithCache = action({
  handler: async (ctx, args: { messages: any[] }) => {
    const cacheKey = JSON.stringify(args.messages);
    const cached = responseCache.get(cacheKey);

    // Use cache if fresh (<1 hour)
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return {
        response: cached.response,
        cached: true,
        age: Date.now() - cached.timestamp
      };
    }

    const response = await chatWithRetry(args.messages);

    responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    return { response, cached: false };
  }
});

// ✅ Solution 4: Upgrade API key plan
// Rate limits depend on plan:
// - Free trial: 3 requests/min, $5 one-time free credit
// - Pay-as-you-go: 90k requests/min, based on usage
// Check at platform.openai.com/account/billing/limits
```

---

## Issue 3: "Context Length Exceeded" Error

**Symptom**: "This model's maximum context length is 8192 tokens exceeded"

**Root Causes**:
1. Conversation history too long
2. Transcript excerpt too large
3. Message too verbose
4. Using model with smaller context (gpt-3.5-turbo)

**Debugging Steps**:

```typescript
// 1. Estimate token count
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  // More accurate: use OpenAI tokenizer library
  return Math.ceil(text.length / 4);
}

// 2. Break down context usage
function analyzeContextUsage(
  systemPrompt: string,
  messages: any[]
): {
  systemTokens: number;
  messagesTokens: number;
  totalTokens: number;
  available: number;
  percentageUsed: number;
} {
  const systemTokens = estimateTokens(systemPrompt);
  const messagesTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0
  );
  const totalTokens = systemTokens + messagesTokens;

  const modelContextLimit = 128000; // gpt-4o: 128k tokens
  const bufferForResponse = 4000;
  const available = modelContextLimit - bufferForResponse;

  return {
    systemTokens,
    messagesTokens,
    totalTokens,
    available,
    percentageUsed: (totalTokens / available) * 100
  };
}

// 3. Identify largest contributions
function findLargestContextContributors(
  systemPrompt: string,
  messages: any[]
): string[] {
  const parts = [
    { name: "System prompt", tokens: estimateTokens(systemPrompt) },
    ...messages.map((m, i) => ({
      name: `Message ${i}: ${m.role}`,
      tokens: estimateTokens(m.content)
    }))
  ];

  return parts
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)
    .map(p => `${p.name}: ~${p.tokens} tokens`);
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Trim conversation history to recent turns only
export const buildContextAwareMessages = async (
  ctx: any,
  videoId: Id<"videos">,
  allMessages: any[]
): Promise<any[]> {
  const contextLimit = 100000; // tokens
  const bufferTokens = 4000; // reserve for response

  let selectedMessages = [...allMessages];
  let totalTokens = estimateTokens(
    selectedMessages.map(m => m.content).join("")
  );

  // Keep trimming until under limit
  while (totalTokens > contextLimit - bufferTokens && selectedMessages.length > 1) {
    // Remove oldest message
    selectedMessages.shift();
    totalTokens = estimateTokens(
      selectedMessages.map(m => m.content).join("")
    );
  }

  console.log("[CONTEXT] Using", selectedMessages.length, "of", allMessages.length, "messages");

  return selectedMessages;
};

// ✅ Solution 2: Summarize old messages instead of removing
export const summarizeOldMessages = async (
  oldMessages: any[]
): Promise<string> => {
  if (oldMessages.length < 4) return ""; // Keep recent messages

  const summaryPrompt = `Summarize the key points from this conversation in 2-3 sentences:
${oldMessages.map(m => `${m.role}: ${m.content}`).join("\n")}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: summaryPrompt }],
    max_tokens: 200
  });

  return response.choices[0]?.message?.content || "";
};

// ✅ Solution 3: Use smaller context window model
const selectModel = (estimatedTokens: number): string => {
  if (estimatedTokens < 4000) return "gpt-4o-mini"; // 128k limit
  if (estimatedTokens < 100000) return "gpt-4o"; // 128k limit
  return "gpt-4-turbo"; // 128k limit, but slower

  // For really large contexts (>100k tokens):
  // Either split into multiple requests or use document API
};

// ✅ Solution 4: Truncate transcript excerpts
function getTruncatedTranscript(
  fullTranscript: string,
  maxTokens: number = 3000
): string {
  const maxChars = maxTokens * 4; // Convert tokens to approx characters
  const truncated = fullTranscript.substring(0, maxChars);

  // Find last complete sentence
  const lastPeriod = truncated.lastIndexOf(".");
  return truncated.substring(0, lastPeriod + 1) + "\n[... transcript continues]";
}

// ✅ Solution 5: Use gpt-4-turbo for large contexts
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo", // Larger context window
  messages,
  max_tokens: 2000
});
```

---

## Issue 4: Web Search Not Working / No Results

**Symptom**: Web search returns empty results or all irrelevant

**Root Causes**:
1. Search API not configured
2. Keyword extraction too aggressive (removes important words)
3. Search API rate limited
4. Query too vague

**Debugging Steps**:

```typescript
// 1. Test web search API
async function testWebSearchAPI(query: string): Promise<{
  working: boolean;
  resultCount: number;
  error?: string;
}> {
  try {
    const results = await performWebSearch(query.split(/\s+/));

    console.log("[SEARCH] Results for", query, ":", results.length);

    return {
      working: results.length > 0,
      resultCount: results.length
    };
  } catch (error) {
    console.error("[SEARCH] Web search failed:", error);
    return {
      working: false,
      resultCount: 0,
      error: String(error)
    };
  }
}

// 2. Check keyword extraction
function debugKeywordExtraction(message: string): {
  original: string;
  keywords: string[];
  quality: "good" | "fair" | "poor";
} {
  const keywords = extractKeywords(message);

  const quality =
    keywords.length >= 3 && keywords.length <= 5
      ? "good"
      : keywords.length > 0
        ? "fair"
        : "poor";

  return { original: message, keywords, quality };
}

// 3. Check search result relevance
function analyzeSearchRelevance(
  query: string,
  results: any[]
): {
  relevantCount: number;
  averageScore: number;
  topResult: any;
} {
  const relevant = results.filter(r => r.relevance > 0.6);

  return {
    relevantCount: relevant.length,
    averageScore:
      results.length > 0
        ? results.reduce((sum, r) => sum + (r.relevance || 0), 0) /
          results.length
        : 0,
    topResult: results[0]
  };
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Improve keyword extraction
function extractBetterKeywords(message: string): string[] {
  const stopWords = new Set([
    "what", "is", "the", "a", "an", "in", "on", "at", "to", "for",
    "and", "or", "but", "can", "could", "would", "should", "do", "does"
  ]);

  const words = message
    .toLowerCase()
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);

  // Prioritize nouns and question keywords
  const questionKeywords = message.match(
    /\b(how|what|why|when|where|which)\b/gi
  ) || [];

  return [
    ...questionKeywords.slice(0, 2),
    ...words.slice(0, 3)
  ];
}

// ✅ Solution 2: Fallback to AI-generated search query
async function generateSearchQuery(userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Generate a concise web search query for this question: "${userMessage}"\nRespond with ONLY the search query, nothing else.`
      }
    ],
    max_tokens: 20
  });

  return response.choices[0]?.message?.content?.trim() || userMessage;
}

// ✅ Solution 3: Retry with different query format
async function searchWithFallback(query: string): Promise<any[]> {
  let results = await performWebSearch(query.split(/\s+/));

  if (results.length === 0 || results[0].relevance < 0.4) {
    // Try generating better query
    const betterQuery = await generateSearchQuery(query);
    console.log("[SEARCH] Retrying with generated query:", betterQuery);

    results = await performWebSearch(betterQuery.split(/\s+/));
  }

  return results;
}

// ✅ Solution 4: Combine multiple search sources
async function searchMultipleSources(query: string): Promise<any[]> {
  const [bingResults, googleResults] = await Promise.all([
    searchBing(query),
    searchGoogle(query)
  ]);

  // Merge and deduplicate by URL
  const merged = new Map<string, any>();

  for (const result of [...bingResults, ...googleResults]) {
    if (!merged.has(result.url) || result.relevance > merged.get(result.url).relevance) {
      merged.set(result.url, result);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.relevance - a.relevance);
}
```

---

## Issue 5: Conversation History Not Loading / Showing Old Messages

**Symptom**: User refreshes page, conversation history is lost or shows wrong messages

**Root Causes**:
1. Database query filtering wrong videoId
2. User ID mismatch in database
3. Conversation deleted accidentally
4. Database not persisting writes

**Debugging Steps**:

```typescript
// 1. Verify database schema
async function checkConversationSchema(ctx: any): Promise<{
  tableExists: boolean;
  sampleCount: number;
  schema: string[];
}> {
  try {
    const sample = await ctx.db
      .query("conversations")
      .take(1)
      .collect();

    const schema = sample.length > 0 ? Object.keys(sample[0]) : [];

    return {
      tableExists: true,
      sampleCount: sample.length,
      schema
    };
  } catch (error) {
    return {
      tableExists: false,
      sampleCount: 0,
      schema: [],
    };
  }
}

// 2. Check filtering logic
async function debugConversationQuery(
  ctx: any,
  videoId: string,
  userId: string
): Promise<{
  byVideo: number;
  byUser: number;
  byBoth: number;
}> {
  const byVideo = await ctx.db
    .query("conversations")
    .filter(c => c.eq(c.field("videoId"), videoId))
    .count();

  const byUser = await ctx.db
    .query("conversations")
    .filter(c => c.eq(c.field("userId"), userId))
    .count();

  const byBoth = await ctx.db
    .query("conversations")
    .filter(c => c.eq(c.field("videoId"), videoId))
    .filter(c => c.eq(c.field("userId"), userId))
    .count();

  return { byVideo, byUser, byBoth };
}

// 3. Check write persistence
async function testWritePersistence(
  ctx: any,
  conversationData: any
): Promise<{ written: boolean; readBack: boolean; match: boolean }> {
  // Write
  const id = await ctx.db.insert("conversations", conversationData);

  // Read back immediately
  const written = !!id;
  const readBack = await ctx.db.get(id);
  const match = JSON.stringify(readBack) === JSON.stringify(conversationData);

  return { written, readBack: !!readBack, match };
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Ensure correct filtering in query
export const loadConversationHistory = query({
  handler: async (ctx, args: { videoId: Id<"videos">; limit?: number }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    console.log("[LOAD] Fetching conversations for:", {
      videoId: args.videoId,
      userId: user.subject
    });

    const turns = await ctx.db
      .query("conversations")
      .filter(c => c.eq(c.field("videoId"), args.videoId)) // BOTH filters
      .filter(c => c.eq(c.field("userId"), user.subject))  // REQUIRED
      .order("desc")
      .take(args.limit || 20);

    console.log("[LOAD] Found", turns.length, "conversation turns");

    return turns;
  }
});

// ✅ Solution 2: Add database indexes
// In schema.ts:
defineTable({
  conversations: defineTable({
    videoId: v.id("videos"),
    userId: v.string(),
    userMessage: v.string(),
    aiResponse: v.string(),
    createdAt: v.number()
  })
    .index("by_video", ["videoId"]) // Fast lookup by video
    .index("by_user", ["userId"])   // Fast lookup by user
    .index("by_both", ["videoId", "userId"]) // Fast lookup by both
});

// ✅ Solution 3: Verify writes complete
export const storeConversationWithVerification = mutation({
  handler: async (ctx, args: any) => {
    const id = await ctx.db.insert("conversations", args);

    // Verify write persisted
    const written = await ctx.db.get(id);
    if (!written) {
      throw new Error("Failed to write conversation to database");
    }

    return { success: true, id };
  }
});

// ✅ Solution 4: Cache locally while loading
const conversationCache = new Map<string, any[]>();

export const getCachedConversation = async (
  videoId: string,
  loadFresh: boolean = false
): Promise<any[]> => {
  if (!loadFresh && conversationCache.has(videoId)) {
    return conversationCache.get(videoId)!;
  }

  // Load from server
  const data = await loadConversationHistory({ videoId });

  // Cache locally
  conversationCache.set(videoId, data);

  return data;
};
```

---

## Summary

These troubleshooting guides cover:

1. **Streaming failures** - Starting/enabling streaming
2. **Rate limiting** - Queue, batch, cache, retry with backoff
3. **Context limits** - Trim history, summarize, use bigger model
4. **Web search issues** - Better keywords, fallback queries
5. **History loading** - Correct filtering, indexes, verification

Use these patterns to diagnose and resolve AI chat issues quickly.
