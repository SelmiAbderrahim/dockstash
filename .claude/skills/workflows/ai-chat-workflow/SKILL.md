---
name: ai-chat-workflow
description: |
  Master the complete AI chat pipeline including real-time streaming responses, web search integration with user approval, context management, and cost optimization.

  When to use: Implementing AI chat features, building conversational interfaces, integrating OpenAI/Gemini, handling streaming responses,
  managing conversation history, web search approval workflows, handling rate limiting, optimizing costs.

  Keywords: AI chat, streaming, web search, context, conversation, OpenAI, Gemini, responses, history, approval workflow
---

# AI Chat Workflow

## Quick Start (Layer 1-2)

The AI chat workflow handles complete conversational AI features including real-time streaming, web search, context management, and cost tracking.

### Three Chat Modes

```typescript
// 1. Basic Chat - Direct response from AI model
const basicChat = async (messages: Array<{ role, content }>) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true,
    temperature: 0.7
  });
  return response; // Stream response to client
};

// 2. Web Search Chat - Search web before responding
const webSearchChat = async (messages: Array<{ role, content }>) => {
  // 1. Check if search needed (user approval)
  // 2. Search web for relevant information
  // 3. Add search results to context
  // 4. Stream response with sources
  return response;
};

// 3. Context-Aware Chat - Use transcript/document context
const contextAwareChat = async (messages, videoId) => {
  // 1. Load transcript for video
  // 2. Add relevant excerpts to system context
  // 3. Stream response grounded in video
  return response;
};
```

### Key Concepts

- **Streaming Responses**: Stream tokens to client in real-time (faster perceived speed)
- **Web Search Integration**: Search web with explicit user approval, cite sources
- **Context Management**: Use video transcripts, documents as conversation context
- **Cost Optimization**: Track token usage, implement per-user limits, cache common queries
- **Error Recovery**: Handle rate limiting, model unavailability, token limit exceeded
- **Conversation History**: Persist multi-turn conversations with proper format

### Most Common Use Case

```typescript
// User uploads video
1. Video gets transcribed
2. User opens chat interface
3. User asks question about video
4. System provides answer grounded in transcript
5. User can request web search for external info
6. Conversation persists for follow-up questions
```

## Key Files & References

- `/prompts/agents/specialized/ai-chat-streaming-specialist.md` - Detailed agent guide
- `guide.md` - Complete implementation patterns (Layer 3)
- `patterns.md` - Advanced patterns and edge cases (Layer 3)
- `troubleshooting.md` - Common issues and solutions (Layer 3)
- `examples/` - Real-world code examples (Layer 3)

## Core Workflow Steps

1. **Chat Initialization Phase**
   - Load conversation history
   - Initialize model client (OpenAI or Gemini)
   - Set up streaming handler
   - Validate user has credits

2. **Request Processing Phase**
   - Validate user message
   - Determine if web search needed
   - Get user approval for web search
   - Build system context (transcript, sources)
   - Create chat completion request

3. **Streaming Phase**
   - Stream tokens to client in real-time
   - Track token count for billing
   - Handle interruption gracefully
   - Buffer and format response

4. **Completion & Storage Phase**
   - Store full conversation turn
   - Update token usage
   - Process citations/sources
   - Clean up resources

## Essential Patterns

### Basic Streaming Pattern
```typescript
export const streamChatResponse = action({
  handler: async (ctx, args: { videoId, messages, useWebSearch }) => {
    // 1. Validate and build context
    const systemPrompt = await buildSystemPrompt(ctx, args.videoId);

    // 2. Create streaming request
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...args.messages],
      stream: true,
      temperature: 0.7
    });

    // 3. Stream tokens and collect full response
    let fullResponse = "";
    let tokenCount = 0;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      fullResponse += token;
      tokenCount += token.length; // Approximate

      // Send to client
      yield { token, totalTokens: tokenCount };
    }

    // 4. Store conversation and update usage
    await ctx.db.insert("conversations", {
      videoId: args.videoId,
      userMessage: args.messages.at(-1).content,
      aiResponse: fullResponse,
      tokenCount,
      timestamp: Date.now()
    });

    return { success: true, totalTokens: tokenCount };
  }
});
```

### Web Search Pattern
```typescript
// User clicks "Search web" button
1. Show approval dialog: "Search the web for latest info?"
2. On approval: Search web for keywords from user query
3. Show search results with citations
4. Pass search results as context to AI model
5. Stream response with [Source: URL] citations
```

### Error Handling Pattern
```typescript
try {
  const response = await openai.chat.completions.create({...});
  // Stream response
} catch (error) {
  if (error.code === "rate_limit_error") {
    // Show: "Too many requests. Try again in a few minutes"
    // Return: Suggestion to wait
  } else if (error.code === "context_length_exceeded") {
    // Show: "Conversation too long. Start new chat"
    // Clear conversation history
  } else if (error.code === "model_not_found") {
    // Show: "AI service temporarily unavailable"
    // Try fallback model
  }
}
```

## What You'll Learn

In this skill, you'll understand:
- How to stream AI responses in real-time
- How to implement web search with user approval
- How to build context from transcripts
- How to manage multi-turn conversations
- How to track costs and usage
- How to handle rate limiting gracefully
- How to cite sources properly
- How to handle token limits

## Next Steps

1. **For Implementation**: See `guide.md` for complete patterns
2. **For Advanced Patterns**: See `patterns.md` for edge cases
3. **For Troubleshooting**: See `troubleshooting.md` for common issues
4. **For Code Examples**: See `examples/` directory
5. **For Related Workflows**: See `transcription-workflow/` or `video-upload-workflow/`
